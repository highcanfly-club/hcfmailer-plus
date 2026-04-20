import passport from '../../lib/passport.js';
import bluebird from 'bluebird';
import { htmlToText } from 'html-to-text';
import routerFactory from '../../lib/router-async.js'
const router = routerFactory.create();


router.postAsync('/html-to-text', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const email = htmlToText(req.body.html, { wordwrap: 130 });

    res.json({ text: email });
});

export default router;
