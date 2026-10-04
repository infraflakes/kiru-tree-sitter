-- Start tree-sitter highlighting for kiru buffers.
--
-- The compiled parser is not committed, so a fresh checkout has no
-- `parser/kiru.so`. Build it once from the committed `src/parser.c`, rebuild
-- it when the source is newer, then register it by path so a stale parser
-- elsewhere on the runtimepath cannot shadow it.

local root = vim.fn.fnamemodify(debug.getinfo(1, 'S').source:sub(2), ':h:h')
local source = root .. '/src/parser.c'
local library = root .. '/parser/kiru.so'

local function modification_time(path)
  local stat = vim.uv.fs_stat(path)
  return stat and stat.mtime.sec or nil
end

--- Build `parser/kiru.so` when it is missing or older than `src/parser.c`.
--- Returns whether a usable library exists.
local function ensure_parser()
  local source_time = modification_time(source)
  local library_time = modification_time(library)
  if library_time and source_time and library_time >= source_time then
    return true
  end
  if vim.fn.executable('cc') == 0 then
    return library_time ~= nil
  end
  vim.fn.mkdir(root .. '/parser', 'p')
  local command = { 'cc', '-shared', '-fPIC', '-O2', '-I', root .. '/src', source, '-o', library }
  local result = vim.system(command):wait()
  if result.code ~= 0 then
    vim.notify(
      'kiru: cannot build the tree-sitter parser: ' .. (result.stderr or ''),
      vim.log.levels.WARN
    )
    return false
  end
  return true
end

if vim.treesitter and vim.treesitter.start and ensure_parser() then
  vim.treesitter.language.add('kiru', { path = library })
  vim.treesitter.start(0, 'kiru')
end

vim.bo.commentstring = '# %s'
