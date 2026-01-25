import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

const ModalForm = ({
  open,
  onOpenChange,
  title,
  fields,
  schema,
  defaultValues,
  onSubmit,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  loading = false,
  variant = 'dialog', // 'dialog' | 'sheet'
}) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm({
    resolver: schema ? zodResolver(schema) : undefined,
    defaultValues,
  });

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleFormSubmit = async (data) => {
    await onSubmit(data);
    reset();
  };

  const renderField = (field) => {
    const error = errors[field.name];

    switch (field.type) {
      case 'select':
        return (
          <Controller
            name={field.name}
            control={control}
            render={({ field: controllerField }) => (
              <div className="space-y-2" key={field.name}>
                <Label htmlFor={field.name} className="text-xs text-muted-foreground">
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                <Select
                  value={controllerField.value}
                  onValueChange={controllerField.onChange}
                >
                  <SelectTrigger
                    className={cn(error && 'ring-1 ring-destructive')}
                    data-testid={`form-field-${field.name}`}
                  >
                    <SelectValue placeholder={field.placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {error && (
                  <p className="text-xs text-destructive">{error.message}</p>
                )}
              </div>
            )}
          />
        );

      case 'textarea':
        return (
          <div className="space-y-2" key={field.name}>
            <Label htmlFor={field.name} className="text-xs text-muted-foreground">
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Textarea
              id={field.name}
              placeholder={field.placeholder}
              className={cn(error && 'ring-1 ring-destructive')}
              data-testid={`form-field-${field.name}`}
              {...register(field.name)}
            />
            {error && (
              <p className="text-xs text-destructive">{error.message}</p>
            )}
          </div>
        );

      case 'checkbox':
        return (
          <Controller
            name={field.name}
            control={control}
            render={({ field: controllerField }) => (
              <div className="flex items-center space-x-2" key={field.name}>
                <Checkbox
                  id={field.name}
                  checked={controllerField.value}
                  onCheckedChange={controllerField.onChange}
                  data-testid={`form-field-${field.name}`}
                />
                <Label htmlFor={field.name} className="text-sm">
                  {field.label}
                </Label>
              </div>
            )}
          />
        );

      case 'number':
        return (
          <div className="space-y-2" key={field.name}>
            <Label htmlFor={field.name} className="text-xs text-muted-foreground">
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              type="number"
              placeholder={field.placeholder}
              className={cn(error && 'ring-1 ring-destructive')}
              data-testid={`form-field-${field.name}`}
              {...register(field.name, { valueAsNumber: true })}
            />
            {error && (
              <p className="text-xs text-destructive">{error.message}</p>
            )}
          </div>
        );

      case 'date':
        return (
          <div className="space-y-2" key={field.name}>
            <Label htmlFor={field.name} className="text-xs text-muted-foreground">
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              type="date"
              className={cn(error && 'ring-1 ring-destructive')}
              data-testid={`form-field-${field.name}`}
              {...register(field.name)}
            />
            {error && (
              <p className="text-xs text-destructive">{error.message}</p>
            )}
          </div>
        );

      default:
        return (
          <div className="space-y-2" key={field.name}>
            <Label htmlFor={field.name} className="text-xs text-muted-foreground">
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              type={field.type || 'text'}
              placeholder={field.placeholder}
              className={cn(error && 'ring-1 ring-destructive')}
              data-testid={`form-field-${field.name}`}
              {...register(field.name)}
            />
            {error && (
              <p className="text-xs text-destructive">{error.message}</p>
            )}
          </div>
        );
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {fields.map(renderField)}
    </form>
  );

  const footerContent = (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={handleClose}
        disabled={loading}
        data-testid="form-cancel-button"
      >
        {cancelLabel}
      </Button>
      <Button
        type="submit"
        disabled={loading}
        onClick={handleSubmit(handleFormSubmit)}
        data-testid="form-submit-button"
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {submitLabel}
      </Button>
    </>
  );

  if (variant === 'sheet') {
    return (
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent data-testid="modal-form-sheet">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="py-4">{formContent}</div>
          <SheetFooter>{footerContent}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent data-testid="modal-form-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {formContent}
        <DialogFooter>{footerContent}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ModalForm;
