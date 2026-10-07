; Local scope and binding queries for kiru.
;
; Names are read top-down and a local shadows an outer binding. A function is
; a scope, so its parameters are visible throughout its body. A block is a
; scope for the bindings it declares. A closure is a scope that captures the
; enclosing locals. A `match` arm and a `for` body are scopes of their own.

; Scopes.
(function_declaration) @scope
(closure) @scope
(block) @scope
(match_arm) @scope
(for_statement) @scope

; Definitions.
(parameter
  name: (identifier) @definition.parameter)

(binding_declaration
  name: (identifier) @definition.var)

(for_statement
  item: (identifier) @definition.var)

(assignment_statement
  target: (path
    name: (identifier) @definition.var))

; References. Path segments resolve against the definitions above.
(identifier) @reference
