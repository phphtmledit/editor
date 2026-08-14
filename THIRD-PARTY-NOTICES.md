# Third-party notices

This notice covers the complete production dependency closure rooted at the six
declared CodeMirror packages, `tinymce@8.8.2`, `mammoth@1.12.1`, and the directly
used modular `underscore@1.13.8`, as locked by `package-lock.json`, plus third-party
components embedded in the selected TinyMCE files. Build-only `typescript@7.0.2`
and `vite@8.2.1`, and their dependency trees,
are intentionally excluded: they are development tools and are not part of the
distributed browser runtime.

The product bundle contains CodeMirror. Mammoth is loaded lazily only after a
validated `.docx` import begins; the E0 diagnostic build exercises the same browser
wrapper and optimized dependency path. Both are covered by this inventory.

The corresponding source distribution is licensed under
`GPL-2.0-or-later`. A package's inclusion below does not change its own license.
Exact license texts copied from the installed packages are under
`third-party-licenses/npm/`. Selected upstream texts for embedded TinyMCE
components are under `third-party-licenses/embedded/`.

## Production npm dependency closure

| Component | Effective license for this distribution | Copyright notice | Upstream |
| --- | --- | --- | --- |
| `@codemirror/autocomplete@6.20.3` | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke and others | [codemirror/autocomplete](https://github.com/codemirror/autocomplete) |
| `@codemirror/commands@6.10.4` | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke and others | [codemirror/commands](https://github.com/codemirror/commands) |
| `@codemirror/lang-css@6.3.1` | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke and others | [codemirror/lang-css](https://github.com/codemirror/lang-css) |
| `@codemirror/lang-html@6.4.12` | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke and others | [codemirror/lang-html](https://github.com/codemirror/lang-html) |
| `@codemirror/lang-javascript@6.2.5` | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke and others | [codemirror/lang-javascript](https://github.com/codemirror/lang-javascript) |
| `@codemirror/language@6.12.4` | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke and others | [codemirror/language](https://github.com/codemirror/language) |
| `@codemirror/lint@6.9.7` | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke and others | [codemirror/lint](https://github.com/codemirror/lint) |
| `@codemirror/search@6.7.1` | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke and others | [codemirror/search](https://github.com/codemirror/search) |
| `@codemirror/state@6.7.1` | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke and others | [codemirror/state](https://github.com/codemirror/state) |
| `@codemirror/view@6.43.8` | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke and others | [codemirror/view](https://github.com/codemirror/view) |
| `@lezer/common@1.5.2` | MIT | Copyright (C) 2018 by Marijn Haverbeke and others | [lezer-parser/common](https://github.com/lezer-parser/common) |
| `@lezer/css@1.3.6` | MIT | Copyright (C) 2018 by Marijn Haverbeke and others | [lezer-parser/css](https://github.com/lezer-parser/css) |
| `@lezer/highlight@1.2.3` | MIT | Copyright (C) 2018 by Marijn Haverbeke and others | [lezer-parser/highlight](https://github.com/lezer-parser/highlight) |
| `@lezer/html@1.3.13` | MIT | Copyright (C) 2018 by Marijn Haverbeke and others | [lezer-parser/html](https://github.com/lezer-parser/html) |
| `@lezer/javascript@1.5.4` | MIT | Copyright (C) 2018 by Marijn Haverbeke and others | [lezer-parser/javascript](https://github.com/lezer-parser/javascript) |
| `@lezer/lr@1.4.10` | MIT | Copyright (C) 2018 by Marijn Haverbeke and others | [lezer-parser/lr](https://github.com/lezer-parser/lr) |
| `@marijn/find-cluster-break@1.0.3` | MIT | Copyright (C) 2024 by Marijn Haverbeke | [marijnh/find-cluster-break](https://github.com/marijnh/find-cluster-break) |
| `@xmldom/xmldom@0.8.14` | MIT | Copyright 2019 - present Christopher J. Brody and other contributors; Copyright 2012 - 2017 @jindw and other contributors | [xmldom/xmldom](https://github.com/xmldom/xmldom) |
| `argparse@1.0.10` | MIT | Copyright (C) 2012 by Vitaly Puzrin | [nodeca/argparse](https://github.com/nodeca/argparse) |
| `base64-js@1.5.1` | MIT | Copyright (c) 2014 Jameson Little | [beatgammit/base64-js](https://github.com/beatgammit/base64-js) |
| `bluebird@3.4.7` | MIT | Copyright (c) 2013-2015 Petka Antonov | [petkaantonov/bluebird](https://github.com/petkaantonov/bluebird) |
| `core-util-is@1.0.3` | MIT | Copyright Node.js contributors. All rights reserved. | [isaacs/core-util-is](https://github.com/isaacs/core-util-is) |
| `crelt@1.0.7` | MIT | Copyright (C) 2020 by Marijn Haverbeke | [marijnh/crelt](https://github.com/marijnh/crelt) |
| `dingbat-to-unicode@1.0.1` | BSD-2-Clause (manifest declaration; see gap below) | No copyright notice is present in the published package; package author metadata names Michael Williamson | [mwilliamson/dingbat-to-unicode](https://github.com/mwilliamson/dingbat-to-unicode) |
| `duck@0.1.12` | BSD-2-Clause (legacy `BSD` metadata normalized only after exact LICENSE verification) | Copyright (c) 2013, Michael Williamson | [mwilliamson/duck](https://github.com/mwilliamson/duck) |
| `immediate@3.0.6` | MIT | Copyright (c) 2012 Barnesandnoble.com, llc, Donavon West, Domenic Denicola, Brian Cavalier | [calvinmetcalf/immediate](https://github.com/calvinmetcalf/immediate) |
| `inherits@2.0.4` | ISC | Copyright (c) Isaac Z. Schlueter | [isaacs/inherits](https://github.com/isaacs/inherits) |
| `isarray@1.0.0` | MIT | Copyright (c) 2013 Julian Gruber &lt;julian@juliangruber.com&gt; | [juliangruber/isarray](https://github.com/juliangruber/isarray) |
| `jszip@3.10.1` | MIT, selected from `(MIT OR GPL-3.0-or-later)` | Copyright (c) 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso | [Stuk/jszip](https://github.com/Stuk/jszip) |
| `lie@3.3.0` | MIT | Copyright (c) 2014-2018 Calvin Metcalf, Jordan Harband | [calvinmetcalf/lie](https://github.com/calvinmetcalf/lie) |
| `lop@0.4.2` | BSD-2-Clause | Copyright (c) 2013, Michael Williamson | [mwilliamson/lop](https://github.com/mwilliamson/lop) |
| `mammoth@1.12.1` | BSD-2-Clause | Copyright (c) 2013, Michael Williamson | [mwilliamson/mammoth.js](https://github.com/mwilliamson/mammoth.js) |
| `option@0.2.4` | BSD-2-Clause | Copyright (c) 2013, Michael Williamson | [mwilliamson/option](https://github.com/mwilliamson/option) |
| `pako@1.0.11` | MIT AND Zlib: MIT for all files except `/lib/zlib`; Zlib for `/lib/zlib` | MIT: Copyright (C) 2014-2017 by Vitaly Puzrin and Andrei Tuputcyn. Zlib code: (C) 1995-2013 Jean-loup Gailly and Mark Adler; (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin | [nodeca/pako](https://github.com/nodeca/pako) |
| `path-is-absolute@1.0.1` | MIT | Copyright (c) Sindre Sorhus &lt;sindresorhus@gmail.com&gt; (sindresorhus.com) | [sindresorhus/path-is-absolute](https://github.com/sindresorhus/path-is-absolute) |
| `process-nextick-args@2.0.1` | MIT | Copyright (c) 2015 Calvin Metcalf | [calvinmetcalf/process-nextick-args](https://github.com/calvinmetcalf/process-nextick-args) |
| `readable-stream@2.3.8` | MIT | Copyright Node.js contributors. All rights reserved; Copyright Joyent, Inc. and other Node contributors. All rights reserved. | [nodejs/readable-stream](https://github.com/nodejs/readable-stream) |
| `safe-buffer@5.1.2` | MIT | Copyright (c) Feross Aboukhadijeh | [feross/safe-buffer](https://github.com/feross/safe-buffer) |
| `setimmediate@1.0.5` | MIT | Copyright (c) 2012 Barnesandnoble.com, llc, Donavon West, and Domenic Denicola | [YuzuJS/setImmediate](https://github.com/YuzuJS/setImmediate) |
| `sprintf-js@1.0.3` | BSD-3-Clause | Copyright (c) 2007-2014, Alexandru Marasteanu &lt;hello [at) alexei (dot] ro&gt; | [alexei/sprintf.js](https://github.com/alexei/sprintf.js) |
| `string_decoder@1.1.1` | MIT | Copyright Node.js contributors. All rights reserved; Copyright Joyent, Inc. and other Node contributors. All rights reserved. | [nodejs/string_decoder](https://github.com/nodejs/string_decoder) |
| `style-mod@4.1.3` | MIT | Copyright (C) 2018 by Marijn Haverbeke and others | [marijnh/style-mod](https://github.com/marijnh/style-mod) |
| `tinymce@8.8.2` | GPL-2.0-or-later (`license.md`; package metadata says `SEE LICENSE IN license.md`) | Copyright (c) 2025 Ephox Corporation DBA Tiny Technologies, Inc. | [tinymce/tinymce-dist](https://github.com/tinymce/tinymce-dist/tree/8.8.2) |
| `underscore@1.13.8` | MIT | Copyright (c) 2009-2022 Jeremy Ashkenas, Julian Gonggrijp, and DocumentCloud and Investigative Reporters & Editors | [jashkenas/underscore](https://github.com/jashkenas/underscore) |
| `util-deprecate@1.0.2` | MIT | Copyright (c) 2014 Nathan Rajlich &lt;nathan@tootallnate.net&gt; | [TooTallNate/util-deprecate](https://github.com/TooTallNate/util-deprecate) |
| `w3c-keyname@2.2.8` | MIT | Copyright (C) 2016 by Marijn Haverbeke and others | [marijnh/w3c-keyname](https://github.com/marijnh/w3c-keyname) |
| `xmlbuilder@10.1.1` | MIT | Copyright (c) 2013 Ozgur Ozcitak | [oozcitak/xmlbuilder-js](https://github.com/oozcitak/xmlbuilder-js) |

`jszip@3.10.1` is used under its MIT alternative. `pako@1.0.11` is not
an alternative-license case: both MIT and Zlib terms apply to their respective
files. The two exact pako texts are preserved separately.

The published `dingbat-to-unicode@1.0.1` package contains no license file and
no copyright notice. Its `package.json` declares `BSD-2-Clause` and identifies
Michael Williamson as the author. This upstream packaging defect cannot be
repaired by inventing a notice; it remains an explicit compliance warning.

## Components embedded by TinyMCE 8.8.2

Only files in `scripts/tinymce-assets.mjs` are copied from TinyMCE. The original
`license.md` and `notices.txt` are copied byte-for-byte to `public/tinymce/`.

| Component | Distribution status | Selected license | Copyright notice |
| --- | --- | --- | --- |
| Derived TinyMCE icon pack (`phphtmledit`) | Generated from the TinyMCE 8.8.2 default icon pack; contains 68 selected icons, with artwork unaltered | GPL-2.0-or-later | Copyright (c) 2025 Ephox Corporation DBA Tiny Technologies, Inc. |
| Derived common emoji database (`emojis-common`) | Generated from the TinyMCE 8.8.2 emoji database (source data: `emojilib@2.4.0`); contains 300 selected entries; names, keywords, Unicode characters, categories and Fitzpatrick metadata are unaltered | MIT (emojilib data) AND GPL-2.0-or-later (TinyMCE Resource wrapper and phphtmledit modifications) | Emoji data Copyright (c) 2014 Mu-An Chiou; TinyMCE wrapper Copyright (c) 2025 Ephox Corporation DBA Tiny Technologies, Inc. |
| DOMPurify 3.4.12 | Executable code is embedded in `tinymce.min.js` and `themes/silver/theme.min.js` | MPL-2.0, selected from `(MPL-2.0 OR Apache-2.0)` | Copyright (c) Cure53 and other contributors |
| prism-themes 1.9.0 | CSS is embedded in the selected Oxide skin assets | MIT | Copyright (c) 2015 PrismJS |
| PrismJS 1.25.0 | Listed by TinyMCE upstream, but its `codesample` plugin is excluded from the selected asset allow-list | MIT | Copyright (c) 2012 Lea Verou |

### DOMPurify vendor metadata mismatch

TinyMCE 8.8.2 contains three different DOMPurify version labels:

- vendor `notices.txt`: `3.3.2`;
- outer `tinymce.min.js` bundle banner: `3.4.11`;
- executable code and preserved internal `@license`: `3.4.12`.

Both selected executable copies set `version="3.4.12"` and carry the internal
DOMPurify 3.4.12 license banner. This distribution selects **MPL-2.0** for those
copies; Apache-2.0 is not selected. All inconsistent upstream labels remain
unchanged in the byte-for-byte TinyMCE files and are documented here instead of
being rewritten.

### Prism components

The selected Oxide CSS preserves the prism-themes attribution and the additional
Dracula-theme credits: the original theme is by Zeno Rocha and the PrismJS port
is by Albert Vallverdu. PrismJS code is not distributed: `plugins/codesample/`
is absent from `scripts/tinymce-assets.mjs`. PrismJS stays in this section only
to explain the unmodified upstream TinyMCE `notices.txt`; it is not included in
the runtime inventory.
