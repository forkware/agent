# Local directory

## Intent

A folder can stand for a project on disk. Agents for its tasks start in that directory instead of a scratch one.

## Spec

- Folder menu: "Bind a directory…" asks for a path (`~` allowed). Empty unbinds. A path that is not a directory is refused with a message.
- The binding is stored in `folder.meta["local-dir"].path` and shown as a badge with the directory's name.
- The nearest bound folder up the tree wins, so subfolders inherit their parent's directory.

## Check

Bind a folder, start an agent in one of its tasks: the path above the terminal is the bound directory.
