// Harmonise les balises de fusion de toutes les listes et campagnes.
// Prénom / nom : noms par défaut du code (server/models/lists.js, assistant "prénom + nom").
// Autres champs : équivalents anglais, dans le même style MERGE_*. Les libellés affichés (Prénom, Adresse...) ne changent pas.
//
//   FIRST_NAME, MERGE_PRENOM      ->  MERGE_FIRST_NAME        MERGE_ADRESSE                 ->  MERGE_ADDRESS
//   MERGE_NOM                     ->  MERGE_LAST_NAME         MERGE_CP, MERGE_CODE_POSTAL   ->  MERGE_POSTAL_CODE
//   MERGE_VILLE                   ->  MERGE_CITY              MERGE_PAYS                    ->  MERGE_COUNTRY
//   MERGE_TELEPHONE               ->  MERGE_PHONE             MERGE_PORTABLE                ->  MERGE_MOBILE
//   MERGE_DATE_DE_NAISSANCE       ->  MERGE_BIRTH_DATE        MERGE_POIDS / MERGE_TAILLE    ->  MERGE_WEIGHT / MERGE_HEIGHT
//   MERGE_LICENCE                 ->  MERGE_LICENSE           MERGE_DATE_DE_CREATION_BANDG  ->  MERGE_BANDG_CREATION_DATE
//   MERGE_ATTRIBUTS_JSON_BRUTS    ->  MERGE_RAW_ATTRIBUTES_JSON
//
// Les types de champs ne sont pas modifiés (ex. date de naissance : "date" en listes 2 et 6, "text" en liste 8).
// Ce qui change : custom_fields.key, lists.to_name, et les balises [..] dans campaigns.data, templates.{html,text,data},
// mosaico_templates.data. Rien d'autre : imports, segments et formulaires référencent les champs par leur colonne
// (custom_first_name_xxx), pas par leur clé, et ne sont donc pas concernés.
//
// Usage :
//   bun scripts/normalize-merge-tags.mjs            # simulation (lecture seule)
//   bun scripts/normalize-merge-tags.mjs --apply    # exécute dans une transaction, après avoir copié les lignes touchées
//                                                   # dans des tables _bak_mergetags_<date>_*
// Variables : MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE.
import mysql from 'mysql2/promise';

const apply = process.argv.includes('--apply');

const KEY_RENAMES = {
  FIRST_NAME: 'MERGE_FIRST_NAME',
  MERGE_PRENOM: 'MERGE_FIRST_NAME',
  MERGE_NOM: 'MERGE_LAST_NAME',
  LAST_NAME: 'MERGE_LAST_NAME',
  MERGE_ADRESSE: 'MERGE_ADDRESS',
  MERGE_CP: 'MERGE_POSTAL_CODE',
  MERGE_CODE_POSTAL: 'MERGE_POSTAL_CODE',
  MERGE_VILLE: 'MERGE_CITY',
  MERGE_PAYS: 'MERGE_COUNTRY',
  MERGE_TELEPHONE: 'MERGE_PHONE',
  MERGE_PORTABLE: 'MERGE_MOBILE',
  MERGE_DATE_DE_NAISSANCE: 'MERGE_BIRTH_DATE',
  MERGE_POIDS: 'MERGE_WEIGHT',
  MERGE_TAILLE: 'MERGE_HEIGHT',
  MERGE_LICENCE: 'MERGE_LICENSE',
  MERGE_DATE_DE_CREATION_BANDG: 'MERGE_BANDG_CREATION_DATE',
  MERGE_ATTRIBUTS_JSON_BRUTS: 'MERGE_RAW_ATTRIBUTES_JSON',
};
const TAG_RENAMES = Object.entries(KEY_RENAMES).map(([from, to]) => [`[${from}]`, `[${to}]`]);
const TEXT_COLUMNS = [
  ['campaigns', ['data', 'subject', 'from_name_override', 'reply_to_override']],
  ['templates', ['html', 'text', 'data']],
  ['mosaico_templates', ['data']],
  ['send_configurations', ['from_name', 'reply_to']],
];

const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  charset: 'utf8mb4',
});

const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
const log = (...a) => console.log(...a);
const run = async (sql, params = []) => (apply ? conn.execute(sql, params) : [{ affectedRows: 0 }]);

try {
  // 1. Clés de champs à renommer (on ne renomme pas si la liste a déjà un champ avec la clé cible)
  const [fields] = await conn.execute('select id, list, `key` from custom_fields order by list, id');
  const byList = new Map();
  for (const f of fields) byList.set(f.list, [...(byList.get(f.list) || []), f]);

  const renames = [];
  for (const [list, fs] of byList) {
    const keys = new Set(fs.map((f) => f.key));
    for (const f of fs) {
      const target = KEY_RENAMES[f.key];
      if (!target) continue;
      if (keys.has(target)) {
        log(`! liste ${list} : ${f.key} -> ${target} impossible, la clé existe déjà (à traiter à la main)`);
        continue;
      }
      renames.push({ ...f, target });
      keys.add(target);
    }
  }
  log(`Champs à renommer : ${renames.length}`);
  renames.forEach((r) => log(`  liste ${r.list} champ #${r.id} : ${r.key} -> ${r.target}`));

  // 2. Modèle "champ À" des listes qui possèdent prénom et nom
  const [lists] = await conn.execute('select id, name, to_name from lists order by id');
  const toNames = [];
  for (const l of lists) {
    const final = new Set((byList.get(l.id) || []).map((f) => renames.find((r) => r.id === f.id)?.target || f.key));
    if (final.has('MERGE_FIRST_NAME') && final.has('MERGE_LAST_NAME') && l.to_name !== '[MERGE_FIRST_NAME] [MERGE_LAST_NAME]') {
      toNames.push(l);
    }
  }
  log(`Listes dont le champ À sera réécrit : ${toNames.length}`);
  toNames.forEach((l) => log(`  liste ${l.id} (${l.name}) : "${l.to_name}" -> "[MERGE_FIRST_NAME] [MERGE_LAST_NAME]"`));

  // 3. Balises dans les contenus
  const textHits = [];
  for (const [table, cols] of TEXT_COLUMNS) {
    for (const col of cols) {
      const cond = TAG_RENAMES.map(() => 'locate(binary ?, `' + col + '`) > 0').join(' or ');
      const [rows] = await conn.execute(`select id from \`${table}\` where ${cond}`, TAG_RENAMES.map(([from]) => from));
      if (rows.length) textHits.push({ table, col, ids: rows.map((r) => r.id) });
    }
  }
  log('Contenus contenant des balises à remplacer :');
  textHits.forEach((h) => log(`  ${h.table}.${h.col} : ids ${h.ids.join(', ')}`));
  if (!textHits.length) log('  aucun');

  if (!apply) {
    log('\nSimulation uniquement. Relancer avec --apply après une sauvegarde (mysqldump).');
  } else {
    // DDL causes an implicit commit in MySQL: take the backups before opening the transaction
    for (const t of ['custom_fields', 'lists', 'campaigns', 'templates', 'mosaico_templates', 'send_configurations']) {
      await conn.query(`create table \`_bak_mergetags_${stamp}_${t}\` as select * from \`${t}\``);
    }
    await conn.beginTransaction();
    try {
      for (const r of renames) await run('update custom_fields set `key` = ? where id = ?', [r.target, r.id]);
      for (const l of toNames) await run('update lists set to_name = ? where id = ?', ['[MERGE_FIRST_NAME] [MERGE_LAST_NAME]', l.id]);
      for (const h of textHits) {
        for (const [from, to] of TAG_RENAMES) {
          await run(`update \`${h.table}\` set \`${h.col}\` = replace(\`${h.col}\`, ?, ?) where id in (${h.ids.map(() => '?').join(',')})`, [from, to, ...h.ids]);
        }
      }
      await conn.commit();
      log(`\nAppliqué. Sauvegardes : tables _bak_mergetags_${stamp}_*`);
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  }
} finally {
  await conn.end();
}
