import * as React from "react";

interface RootProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AlertDialog({ children }: RootProps) {
  return <>{children}</>;
}

export function AlertDialogContent(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

export function AlertDialogDescription(props: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} />;
}

export function AlertDialogFooter(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

export function AlertDialogHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

export function AlertDialogTitle(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 {...props} />;
}

export function AlertDialogAction(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} />;
}

export function AlertDialogCancel(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} />;
}
