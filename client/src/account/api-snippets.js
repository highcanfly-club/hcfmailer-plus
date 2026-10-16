'use strict';

// Generates ready-to-run code samples for an API call.
// call: { method, url, query: {k: v}, form: {k: v} | null }
// The access token is kept in a constant at the top of each sample.

const q = value => JSON.stringify(String(value));

function entries(obj) {
    return Object.entries(obj || {});
}

function typescript({ method, url, query, form, token }) {
    const hasForm = entries(form).length > 0;
    const lines = [
        '// Run with: npx tsx example.ts   (Node.js 18+, no dependency needed)',
        `const ACCESS_TOKEN = ${q(token)};`,
        `const URL_ = ${q(url)};`,
        '',
        'async function main(): Promise<void> {',
        '    const url = new URL(URL_);',
        '    url.searchParams.set("access_token", ACCESS_TOKEN);'
    ];
    for (const [k, v] of entries(query)) {
        lines.push(`    url.searchParams.set(${q(k)}, ${q(v)});`);
    }
    if (hasForm) {
        lines.push('', '    const body = new URLSearchParams({');
        entries(form).forEach(([k, v], i, arr) => lines.push(`        ${q(k)}: ${q(v)}${i < arr.length - 1 ? ',' : ''}`));
        lines.push('    });');
    }
    lines.push('', `    const response = await fetch(url, {`, `        method: ${q(method)}${hasForm ? ',' : ''}`);
    if (hasForm) {
        lines.push('        headers: { "Content-Type": "application/x-www-form-urlencoded" },', '        body');
    }
    lines.push(
        '    });',
        '',
        '    console.log(response.status, await response.text());',
        '}',
        '',
        'main().catch(err => { console.error(err); process.exit(1); });'
    );
    return lines.join('\n');
}

function python({ method, url, query, form, token }) {
    const hasForm = entries(form).length > 0;
    const dict = obj => '{\n' + entries(obj).map(([k, v]) => `    ${q(k)}: ${q(v)},\n`).join('') + '}';
    const lines = [
        '# Run with: python3 example.py   (pip install requests)',
        'import requests',
        '',
        `ACCESS_TOKEN = ${q(token)}`,
        `URL = ${q(url)}`,
        '',
        `params = {"access_token": ACCESS_TOKEN${entries(query).map(([k, v]) => `, ${q(k)}: ${q(v)}`).join('')}}`
    ];
    if (hasForm) {
        lines.push(`data = ${dict(form)}`);
    }
    lines.push(
        '',
        `response = requests.request(${q(method)}, URL, params=params${hasForm ? ', data=data' : ''}, timeout=30)`,
        'print(response.status_code, response.text)'
    );
    return lines.join('\n');
}

function golang({ method, url, query, form, token }) {
    const hasForm = entries(form).length > 0;
    const lines = [
        '// Run with: go run example.go',
        'package main',
        '',
        'import (',
        '\t"fmt"',
        '\t"io"',
        '\t"net/http"',
        '\t"net/url"',
        ...(hasForm ? ['\t"strings"'] : []),
        ')',
        '',
        `const accessToken = ${q(token)}`,
        `const apiURL = ${q(url)}`,
        '',
        'func main() {',
        '\tu, err := url.Parse(apiURL)',
        '\tif err != nil {',
        '\t\tpanic(err)',
        '\t}',
        '\tquery := u.Query()',
        '\tquery.Set("access_token", accessToken)',
        ...entries(query).map(([k, v]) => `\tquery.Set(${q(k)}, ${q(v)})`),
        '\tu.RawQuery = query.Encode()'
    ];
    if (hasForm) {
        lines.push('', '\tform := url.Values{}', ...entries(form).map(([k, v]) => `\tform.Set(${q(k)}, ${q(v)})`));
    }
    lines.push(
        '',
        `\treq, err := http.NewRequest(${q(method)}, u.String(), ${hasForm ? 'strings.NewReader(form.Encode())' : 'nil'})`,
        '\tif err != nil {',
        '\t\tpanic(err)',
        '\t}'
    );
    if (hasForm) {
        lines.push('\treq.Header.Set("Content-Type", "application/x-www-form-urlencoded")');
    }
    lines.push(
        '',
        '\tresp, err := http.DefaultClient.Do(req)',
        '\tif err != nil {',
        '\t\tpanic(err)',
        '\t}',
        '\tdefer resp.Body.Close()',
        '',
        '\tbody, _ := io.ReadAll(resp.Body)',
        '\tfmt.Println(resp.StatusCode, string(body))',
        '}'
    );
    return lines.join('\n');
}

export const languages = [
    { id: 'typescript', label: 'TypeScript', generate: typescript },
    { id: 'python', label: 'Python', generate: python },
    { id: 'go', label: 'Go', generate: golang }
];
