; Syntax highlighting for kiru.
;
; The palette is deliberately small. Tree-sitter's own guidance is that an
; entity should be colored the same wherever it appears, so a name never
; changes color between its declaration, its uses and its call sites, and a
; namespace is colored like any other name. Color is spent only on what a
; reader scans a file for: comments, strings, the keywords that shape a run,
; the value kinds, types, and the names you can call. Every other name, whether
; a value, a parameter, a field, a record key or a namespace, shares one color.
;
; The captures are the standard Neovim names, so any colorscheme that supports
; Tree-sitter highlighting works without extra groups. Neovim applies patterns
; in order, so a general capture comes first and the more specific capture that
; shares a node comes later and wins.

; Comments and strings.
(comment) @comment
(string) @string
(escape_sequence) @string.escape
(interpolation) @string.special

; The keywords that shape a run.
[
  "mod"
  "import"
  "use"
  "pub"
  "let"
  "type"
  "rec"
  "enum"
  "return"
  "panic"
  "async"
  "wait"
  "for"
  "in"
  "break"
] @keyword

"fn" @keyword.function
"match" @keyword.conditional

[ "true" "false" ] @boolean
(number) @number

; Every name is a value until a pattern below says otherwise, so a name keeps
; one color wherever it appears. The patterns below are more specific and share
; a node with this one, so they come after it and win.
(identifier) @variable

; A type is named wherever a type is written: a binding, a parameter, a field,
; a return, a type argument. The built-in names (`txt`, `vec`, `map`, `bool`,
; `int`) are ordinary identifiers, so the position says it is a type, not the
; spelling.
(type
  (named_type
    path: (path
      name: (identifier) @type)))

; The parameters of a generic declaration.
(type_parameters
  (identifier) @type)

; The name a declaration gives a type.
(rec_declaration
  name: (identifier) @type)

(enum_declaration
  name: (identifier) @type)

(type_declaration
  name: (identifier) @type)

; The name a declaration gives one variant of an enum.
(variant_declaration
  name: (identifier) @constructor)

; Kiru has one kind of callable. A function in the root namespace, a function
; in another namespace and a function the standard library provides are all
; entries in one registry, so all of them are named the same color as the
; function they are declared by.
(function_declaration
  name: (identifier) @function)

(call_expression
  callee: (path
    name: (identifier) @function))

(method_call
  method: (identifier) @function.method)

; Operators.
[
  "||"
  "&&"
  "=="
  "!="
  "<"
  "<="
  ">"
  ">="
  "+"
  "-"
  "*"
  "/"
  "%"
  "!"
  "="
  "->"
  "=>"
] @operator

; Brackets and delimiters.
[
  "("
  ")"
  "{"
  "}"
  "["
  "]"
] @punctuation.bracket

[
  ","
  ";"
  "."
  "::"
  ":"
] @punctuation.delimiter
