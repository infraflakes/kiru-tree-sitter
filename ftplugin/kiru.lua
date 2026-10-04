-- Start tree-sitter highlighting for kiru buffers.
--
-- The compiled parser is not committed, so a fresh checkout has no
-- `parser/kiru.so`. Build it once from the committed `src/parser.c`, rebuild
-- it when the source is newer, then register it by path so a stale parser
-- elsewhere on the runtimepath cannot shadow it. A read-only install (for
-- example a Nix store path) cannot hold the build, so the cache directory
-- stands in.

local root = vim.fn.fnamemodify(debug.getinfo(1, 'S').source:sub(2), ':h:h')
local source = root .. '/src/parser.c'

local function modification_time(path)
  local stat = vim.uv.fs_stat(path)
  return stat and stat.mtime.sec or nil
end

--- The library to load, building it when needed. Returns its path, or nil
--- when no library exists and none can be built.
local function ensure_parser()
  local shipped = root .. '/parser/kiru.so'
  local cached = vim.fn.stdpath('cache') .. '/kiru-tree-sitter/kiru.so'
  -- `filewritable` returns 2 for a writable directory, 0 when it is not.
  local candidates = vim.fn.filewritable(root) ~= 0 and { shipped } or { shipped, cached }

  local source_time = modification_time(source)
  for _, library in ipairs(candidates) do
    local library_time = modification_time(library)
    if library_time and (not source_time or library_time >= source_time) then
      return library
    end
  end

  local library = candidates[#candidates]
  if not vim.system or vim.fn.executable('cc') == 0 then
    return nil
  end
  vim.fn.mkdir(vim.fn.fnamemodify(library, ':h'), 'p')
  local command = { 'cc', '-shared', '-fPIC', '-O2', '-I', root .. '/src', source, '-o', library }
  local result = vim.system(command):wait()
  if result.code ~= 0 then
    vim.notify(
      'kiru: cannot build the tree-sitter parser: ' .. (result.stderr or ''),
      vim.log.levels.WARN
    )
    return nil
  end
  return library
end

local library = ensure_parser()
if vim.treesitter and vim.treesitter.start and library then
  vim.treesitter.language.add('kiru', { path = library })
  vim.treesitter.start(0, 'kiru')
end

vim.bo.commentstring = '# %s'
