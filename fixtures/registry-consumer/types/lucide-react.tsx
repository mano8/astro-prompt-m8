import * as React from "react";

export type IconProps = React.SVGProps<SVGSVGElement>;
export type Icon = React.ComponentType<IconProps>;

function createIcon(name: string): Icon {
  const Component = (props: IconProps) => <svg aria-label={name} {...props} />;
  Component.displayName = name;
  return Component;
}

export const AlertCircle = createIcon("AlertCircle");
export const ArrowDown = createIcon("ArrowDown");
export const ArrowUp = createIcon("ArrowUp");
export const Boxes = createIcon("Boxes");
export const Check = createIcon("Check");
export const ChevronLeft = createIcon("ChevronLeft");
export const ChevronRight = createIcon("ChevronRight");
export const ChevronsLeft = createIcon("ChevronsLeft");
export const ChevronsRight = createIcon("ChevronsRight");
export const ChevronsUpDown = createIcon("ChevronsUpDown");
export const Copy = createIcon("Copy");
export const Download = createIcon("Download");
export const EyeOff = createIcon("EyeOff");
export const FileText = createIcon("FileText");
export const FolderTree = createIcon("FolderTree");
export const Inbox = createIcon("Inbox");
export const Plus = createIcon("Plus");
export const PlusCircle = createIcon("PlusCircle");
export const Search = createIcon("Search");
export const Settings2 = createIcon("Settings2");
export const ShieldAlert = createIcon("ShieldAlert");
export const Upload = createIcon("Upload");
export const Users = createIcon("Users");
export const Wand2 = createIcon("Wand2");
export const X = createIcon("X");
