# Preserved third-party license texts

`npm/` contains unmodified license-bearing files from the exact packages in the
production dependency closure. `npm run licenses` compares every available copy
with the installed package. `dingbat-to-unicode@1.0.1` is the sole exception:
the published package contains no license file or copyright notice, so no text
is fabricated here.

Special cases:

- `duck@0.1.12` declares the legacy value `BSD`; its exact published `LICENSE`
  has SHA-256
  `6663bbd049205d38a496ccacb412a151980b444627d38de218b3b809aef330f1`
  and is verified as BSD-2-Clause before normalization.
- `jszip@3.10.1` offers `MIT OR GPL-3.0-or-later`; this distribution selects
  MIT. Its upstream combined license file is preserved unchanged.
- `pako@1.0.11` uses `MIT AND Zlib`. The package-level MIT file and the exact
  Zlib notice extracted from the shipped `/lib/zlib` source are preserved as
  separate files.
- `tinymce@8.8.2` uses `SEE LICENSE IN license.md`; its package license file is
  preserved unchanged and resolves to GPL-2.0-or-later.

`embedded/` contains the license branches selected for components embedded in
the copied TinyMCE assets:

| File | Exact upstream source | SHA-256 |
| --- | --- | --- |
| `DOMPurify-3.4.12-MPL-2.0.txt` | [DOMPurify 3.4.12 `LICENSE-MPL`](https://github.com/cure53/DOMPurify/blob/3.4.12/LICENSE-MPL) | `fab3dd6bdab226f1c08630b1dd917e11fcb4ec5e1e020e2c16f83a0a13863e85` |
| `PrismJS-1.25.0-MIT.txt` | [PrismJS 1.25.0 `LICENSE`](https://github.com/PrismJS/prism/blob/v1.25.0/LICENSE) | `2b947f0901a7ffcf08a89957da9783c0e9c6e72cb6ce8e959f501ab5409e4d2b` |
| `prism-themes-1.9.0-MIT.txt` | [prism-themes 1.9.0 `LICENSE`](https://github.com/PrismJS/prism-themes/blob/v1.9.0/LICENSE) | `e2264658d7deb2bfb574e3d6c9cff84d0e081a6887694d46c3c091e6e15a1119` |

The PrismJS license is retained for auditability because TinyMCE's unmodified
`notices.txt` lists it. PrismJS executable code is not distributed by this
project: the `codesample` plugin is outside the TinyMCE asset allow-list.
