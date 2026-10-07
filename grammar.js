/**
 * Tree-sitter grammar for the kiru language.
 *
 * The grammar follows the accepted syntax in the appendix grammar
 * (`docs/.../appendix/grammar.md`) and the recursive descent parser in
 * `src/syntax/parser/`. Every declaration and every statement ends with `;`,
 * including a braced block used as a statement.
 *
 * A file is a sequence of items in any order:
 *
 *   item        := declaration | module | import | use
 *   module      := "mod" path "{" (declaration | use)* "}" ";"
 *   import      := "import" string ";"
 *   use         := "use" path ";"
 *   declaration := "pub"? (function | binding | type | rec | enum)
 *   function    := "fn" ident type_params? "(" params? ")" ("->" type)? block ";"
 *   binding     := "let" ident ":" type "=" expression ";"
 *   type        := "type" ident type_params? ";"
 *   rec         := "rec" ident type_params? "{" (field ("," field)* ","?)? "}" ";"
 *   enum        := "enum" ident type_params? "{" (variant ("," variant)* ","?)? "}" ";"
 *
 * Expressions carry the full operator precedence (`||`, `&&`, `== !=`,
 * `< <= > >=`, `+ -`, `* / %`, unary `- !`), a path call `f(x)`, a method call
 * `recv.name(x)`, a field read, an index, a map literal, a vec literal, a
 * closure, and a `match` term. `( ... )` groups an expression and carries no
 * node of its own.
 *
 * The built-in type names (`txt`, `vec`, `map`, `bool`, `int`) are ordinary
 * identifiers, not keywords; the reserved words are `mod`, `import`, `use`,
 * `pub`, `fn`, `let`, `enum`, `type`, `rec`, `match`, `return`, `panic`,
 * `async`, `wait`, `for`, `in`, `break`, `true`, and `false`.
 *
 * @file Tree-sitter grammar for kiru.
 * @license MIT
 */

// Operator binding powers: a higher number binds tighter. They mirror
// `precedence` in `src/syntax/parser/expressions.rs`.
const PREC = {
  OR: 1,
  AND: 2,
  EQUALITY: 3,
  COMPARISON: 4,
  ADDITIVE: 5,
  MULTIPLICATIVE: 6,
  UNARY: 7,
  POSTFIX: 8,
  CALL: 9,
};

// A comma separated list that may be empty, with an optional trailing comma.
function commaSep(rule) {
  return optional(seq(rule, repeat(seq(',', rule)), optional(',')));
}

// A comma separated list of at least one element, with an optional trailing
// comma.
function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)), optional(','));
}

module.exports = grammar({
  name: 'kiru',

  // Reserving the identifier rule lets the lexer treat the language keywords
  // as whole words, so `true` never lexes as the identifier `tr`.
  word: $ => $.identifier,

  extras: $ => [
    $.comment,
    /[\s]/,
  ],

  rules: {
    // A whole source file: its top-level items in any order.
    source_file: $ => repeat($._item),

    // One top-level item. `import` is global-level only; `use` may be written
    // at the top level or inside a `mod`.
    _item: $ => choice(
      $.import_declaration,
      $.use_declaration,
      $.module_declaration,
      $._declaration,
    ),

    // `mod a::b { declarations };` declares an inline namespace. A file may
    // hold several, and reopening a path merges into the same namespace. A
    // module path is never rooted.
    module_declaration: $ => seq(
      'mod',
      field('path', alias($._plain_path, $.path)),
      '{',
      repeat(choice($._declaration, $.use_declaration)),
      '}',
      ';',
    ),

    // `import "relative/or/absolute/path";`
    import_declaration: $ => seq(
      'import',
      field('path', $.string),
      ';',
    ),

    // `use a::b;` brings the public names of `a::b` into scope;
    // `use a::b::name;` brings one declaration. A use path is never rooted.
    use_declaration: $ => seq(
      'use',
      field('path', alias($._plain_path, $.path)),
      ';',
    ),

    // A declaration, optionally marked `pub` so another namespace may reach it.
    _declaration: $ => seq(
      optional('pub'),
      choice(
        $.function_declaration,
        $.binding_declaration,
        $.type_declaration,
        $.rec_declaration,
        $.enum_declaration,
      ),
    ),

    // `fn name<T>(a: T, b: int) -> Type { ... };`. An absent return type means
    // the function returns no value.
    function_declaration: $ => seq(
      'fn',
      field('name', $.identifier),
      optional(field('type_parameters', $.type_parameters)),
      field('parameters', $.parameter_list),
      optional(seq('->', field('returns', $.type))),
      field('body', $.block),
      ';',
    ),

    // `let name: Type = value;`, at the top level or as a local binding.
    binding_declaration: $ => seq(
      'let',
      field('name', $.identifier),
      ':',
      field('type', $.type),
      '=',
      field('value', $._expression),
      ';',
    ),

    // `type Name<...>;` declares a built-in type the runtime provides; the
    // missing body is the marker.
    type_declaration: $ => seq(
      'type',
      field('name', $.identifier),
      optional(field('type_parameters', $.type_parameters)),
      ';',
    ),

    // `rec Name<...> { field: Type, ... };` declares a nominal type.
    rec_declaration: $ => seq(
      'rec',
      field('name', $.identifier),
      optional(field('type_parameters', $.type_parameters)),
      '{',
      commaSep($.field_declaration),
      '}',
      ';',
    ),

    // `enum Name<...> { Variant, Variant(Type, ...), ... };`
    enum_declaration: $ => seq(
      'enum',
      field('name', $.identifier),
      optional(field('type_parameters', $.type_parameters)),
      '{',
      commaSep($.variant_declaration),
      '}',
      ';',
    ),

    // One `name: Type` field of a `rec` declaration.
    field_declaration: $ => seq(
      field('name', $.identifier),
      ':',
      field('type', $.type),
    ),

    // One `Name` or `Name(Type, ...)` variant of an `enum`.
    variant_declaration: $ => seq(
      field('name', $.identifier),
      optional(seq('(', commaSep($.type), ')')),
    ),

    // `<A, B>` type parameters on a declaration or a function.
    type_parameters: $ => seq(
      '<',
      commaSep1($.identifier),
      '>',
    ),

    // `(a: T, b: int)`, a function's or closure's parameter list.
    parameter_list: $ => seq(
      '(',
      commaSep($.parameter),
      ')',
    ),

    // One parameter: its name, then its type after a colon.
    parameter: $ => seq(
      field('name', $.identifier),
      ':',
      field('type', $.type),
    ),

    // A written type: a function type, or a name applied to type arguments.
    type: $ => choice(
      $.function_type,
      $.named_type,
    ),

    // `fn(T1, T2)` returns nothing; `fn(T1, T2) -> R` returns a value.
    function_type: $ => seq(
      'fn',
      '(',
      commaSep($.type),
      ')',
      optional(seq('->', field('returns', $.type))),
    ),

    // `txt`, `vec<T>`, `map<K, V>`, `Name<A, B>`, or `::a::Name`.
    named_type: $ => seq(
      field('path', $.path),
      optional(field('type_arguments', $.type_arguments)),
    ),

    // `<T, U>` type arguments applied to a named type.
    type_arguments: $ => seq(
      '<',
      commaSep1($.type),
      '>',
    ),

    // A `::` qualified path, optionally rooted with a leading `::`. Every
    // segment but the last names a namespace; the last names the declaration.
    // The precedence lets an `identifier` reduce to a path rather than shift
    // `=` as a map field, so a `{ ... }` arm body reads as a block.
    path: $ => prec(1, seq(
      optional('::'),
      repeat(seq($.identifier, '::')),
      field('name', $.identifier),
    )),

    // A `mod` or `use` path: a `::` qualified name that is never rooted.
    _plain_path: $ => seq(
      repeat(seq($.identifier, '::')),
      field('name', $.identifier),
    ),

    // `{ statement* }`, a function body, a match arm body, or a loop body. An
    // empty `{}` is always a block, never an empty map literal: the precedence
    // picks the block when the two could otherwise collide.
    block: $ => prec(1, seq(
      '{',
      repeat($._statement),
      '}',
    )),

    // A statement inside a block.
    _statement: $ => choice(
      $.binding_declaration,
      $.assignment_statement,
      $.return_statement,
      $.panic_statement,
      $.async_statement,
      $.wait_statement,
      $.for_statement,
      $.break_statement,
      $.expression_statement,
    ),

    // `name = expression;`, `name.field = expression;`, or
    // `name[index] = expression;` — one assignment shape whose target is the
    // expression on the left. The parser reads the left side as an expression
    // and then sees `=`, so a field access and a method call share the
    // `identifier` reduction with the assignment target; the checker restricts
    // the target to a bare name, a field, or an index.
    assignment_statement: $ => seq(
      field('target', $._expression),
      '=',
      field('value', $._expression),
      ';',
    ),

    // `return;` ends a function with no return type; `return expr;` returns a
    // value.
    return_statement: $ => seq(
      'return',
      optional(field('value', $._expression)),
      ';',
    ),

    // `panic;` exits the program with an error.
    panic_statement: $ => seq('panic', ';'),

    // `async <call>;` starts a call on its own thread.
    async_statement: $ => seq(
      'async',
      field('call', $._expression),
      ';',
    ),

    // `wait;` joins the asyncs the calling thread spawned.
    wait_statement: $ => seq('wait', ';'),

    // `for item in <vec> { ... };` runs once per element; `for { ... };`
    // repeats until a `break`.
    for_statement: $ => seq(
      'for',
      optional(seq(
        field('item', $.identifier),
        'in',
        field('iterable', $._expression),
      )),
      field('body', $.block),
      ';',
    ),

    // `break;` ends the nearest enclosing loop.
    break_statement: $ => seq('break', ';'),

    // A bare expression used as a statement: always a call or a match.
    expression_statement: $ => seq(
      $._expression,
      ';',
    ),

    // An expression, by precedence. `_expression` is hidden; each operator
    // level is a named `binary_expression`.
    _expression: $ => choice(
      $.binary_expression,
      $._unary,
    ),

    binary_expression: $ => choice(
      prec.left(PREC.OR, seq(
        field('left', $._expression),
        field('operator', '||'),
        field('right', $._expression),
      )),
      prec.left(PREC.AND, seq(
        field('left', $._expression),
        field('operator', '&&'),
        field('right', $._expression),
      )),
      prec.left(PREC.EQUALITY, seq(
        field('left', $._expression),
        field('operator', choice('==', '!=')),
        field('right', $._expression),
      )),
      prec.left(PREC.COMPARISON, seq(
        field('left', $._expression),
        field('operator', choice('<', '<=', '>', '>=')),
        field('right', $._expression),
      )),
      prec.left(PREC.ADDITIVE, seq(
        field('left', $._expression),
        field('operator', choice('+', '-')),
        field('right', $._expression),
      )),
      prec.left(PREC.MULTIPLICATIVE, seq(
        field('left', $._expression),
        field('operator', choice('*', '/', '%')),
        field('right', $._expression),
      )),
    ),

    _unary: $ => choice(
      $.unary_expression,
      $._postfix,
    ),

    // `-x` or `!x`, applied to another unary or a postfix expression.
    unary_expression: $ => prec(PREC.UNARY, seq(
      field('operator', choice('-', '!')),
      field('operand', $._unary),
    )),

    _postfix: $ => choice(
      $.method_call,
      $.field_access,
      $.index_expression,
      $._primary,
    ),

    // `receiver.name(arguments)`: a method call.
    method_call: $ => prec.left(PREC.POSTFIX, seq(
      field('receiver', $._postfix),
      '.',
      field('method', $.identifier),
      field('arguments', $.arguments),
    )),

    // `target.field`: a field read.
    field_access: $ => prec.left(PREC.POSTFIX, seq(
      field('target', $._postfix),
      '.',
      field('field', $.identifier),
    )),

    // `target[index]`: the element of a vec at an index.
    index_expression: $ => prec.left(PREC.POSTFIX, seq(
      field('target', $._postfix),
      '[',
      field('index', $._expression),
      ']',
    )),

    // A primary expression. A `( ... )` grouping carries no node: the parens
    // only steer precedence, which the tree already records.
    _primary: $ => choice(
      $.string,
      $.number,
      $.boolean,
      $.map_literal,
      $.vec_literal,
      seq('(', $._expression, ')'),
      $.closure,
      $.match_expression,
      $.call_expression,
      $.path,
    ),

    // `path(arguments)` calls a function by path.
    call_expression: $ => prec(PREC.CALL, seq(
      field('callee', $.path),
      field('arguments', $.arguments),
    )),

    // `(expression, ...)`, a call's or method's argument list.
    arguments: $ => seq(
      '(',
      commaSep($._expression),
      ')',
    ),

    // `{ key = expression, ... }`, an anonymous map or record literal.
    map_literal: $ => seq(
      '{',
      commaSep($.map_field),
      '}',
    ),

    // One `key = expression` field of a map literal.
    map_field: $ => seq(
      field('name', $.identifier),
      '=',
      field('value', $._expression),
    ),

    // `[expression, ...]`, a vec literal.
    vec_literal: $ => seq(
      '[',
      commaSep($._expression),
      ']',
    ),

    // `fn(a: T) -> R { ... }`, a closure value in expression position.
    closure: $ => seq(
      'fn',
      field('parameters', $.parameter_list),
      optional(seq('->', field('returns', $.type))),
      field('body', $.block),
    ),

    // `match subject { pattern => body; ... }`, a term. A pattern is an
    // expression; an arm body is an expression or a block.
    match_expression: $ => seq(
      'match',
      field('subject', $._expression),
      '{',
      repeat($.match_arm),
      '}',
    ),

    // One `pattern => body;` arm. The pattern is a literal, a name, a field
    // path, or a variant pattern `Name.Variant` / `Name.Variant(bind, ...)`.
    match_arm: $ => seq(
      field('pattern', $._expression),
      '=>',
      field('body', choice($.block, $._expression)),
      ';',
    ),

    // A `true` or `false` literal.
    boolean: _ => choice('true', 'false'),

    // An integer literal. The sign is a separate unary operator.
    number: _ => /\d+/,

    // A name. The lexer accepts any Unicode alphabetic start and any Unicode
    // alphanumeric continuation, so the grammar does too.
    identifier: _ => /[_\p{L}][_\p{L}\p{N}]*/,

    // A double quoted string: literal text, the six escapes, and `@(expr)`
    // interpolation. A string may span lines.
    string: $ => seq(
      '"',
      repeat(choice(
        $.interpolation,
        $.escape_sequence,
        $._string_text,
        '@',
      )),
      '"',
    ),

    // `@(expression)`, an interpolation inside a string.
    interpolation: $ => seq(
      '@(',
      field('value', $._expression),
      ')',
    ),

    // `\n`, `\t`, `\r`, `\e`, `\\`, `\"`, or `\@`.
    escape_sequence: _ => token.immediate(/\\(?:n|t|r|e|\\|"|@)/),

    // A run of literal string text: everything but a quote, a backslash, or an
    // interpolation opener. `token.immediate` keeps the surrounding whitespace
    // from being skipped as an extra.
    _string_text: _ => token.immediate(/[^"\\@]+/),

    // A `#` comment running to the end of the line.
    comment: _ => token(seq('#', /[^\n]*/)),
  },
});
