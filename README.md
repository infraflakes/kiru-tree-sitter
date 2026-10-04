# kiru-tree-sitter

Tree-sitter grammar for [Kiru](https://github.com/infraflakes/kiru): syntax
highlighting and local scopes for `.kiru` files.

## Neovim

Requirements: Neovim 0.10+ and a C compiler on `PATH`. The plugin builds its
parser on the first `.kiru` buffer, so there is nothing else to install.

**lazy.nvim**

```lua
{
  "infraflakes/kiru-tree-sitter",
  ft = "kiru",
}
```

**Manual**

```sh
git clone https://github.com/infraflakes/kiru-tree-sitter
```

```lua
vim.opt.runtimepath:append("/path/to/kiru-tree-sitter")
```

**Try it without changing your config**

```sh
nvim --cmd "set runtimepath+=/path/to/kiru-tree-sitter" file.kiru
```

## Helix

Add this to `~/.config/helix/languages.toml`:

```toml
[[language]]
name = "kiru"
scope = "source.kiru"
file-types = ["kiru"]
grammar = "kiru"

[[grammar]]
name = "kiru"
source = { git = "https://github.com/infraflakes/kiru-tree-sitter", rev = "main" }
```

Then build it:

```sh
hx --grammar fetch
hx --grammar build
```

## Zed

No published extension yet. The grammar plus `queries/kiru/highlights.scm` and
`queries/kiru/locals.scm` are enough for a custom extension targeting
`source.kiru`.

## Other editors

The generated parser is committed under `src/`, so an editor only has to
compile it into a shared library (ABI 14):

```sh
cc -shared -fPIC -O2 -I src src/parser.c -o parser/kiru.so
```

## Development

```sh
tree-sitter generate   # regenerate src/ from grammar.js
tree-sitter test       # run the corpus tests
```

`src/` is committed, so consumers never need the tree-sitter CLI.

## License

MIT. See `LICENSE`.
