// Consumer-owned shadcn `form` primitive, stubbed at the shape the skins use.
import * as React from "react";

import type {
  Control,
  ControllerRenderProps,
  ControllerFieldState,
  FieldName,
  FieldValues,
  FormState,
  UseFormReturn,
} from "react-hook-form";

export function Form<TValues extends FieldValues>({
  children,
}: React.PropsWithChildren<UseFormReturn<TValues>>) {
  return <>{children}</>;
}

export interface FormFieldProps<TValues extends FieldValues, TName extends FieldName<TValues>> {
  control: Control<TValues>;
  name: TName;
  render: (renderProps: {
    field: ControllerRenderProps<TValues, TName>;
    fieldState: ControllerFieldState;
    formState: FormState<TValues>;
  }) => React.ReactElement;
}

export function FormField<TValues extends FieldValues, TName extends FieldName<TValues>>(
  _props: FormFieldProps<TValues, TName>,
): React.ReactElement | null {
  return null;
}

export function FormItem(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

export function FormLabel(props: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...props} />;
}

export function FormControl({ children }: React.PropsWithChildren) {
  return <>{children}</>;
}

export function FormDescription(props: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} />;
}

export function FormMessage(props: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} />;
}
