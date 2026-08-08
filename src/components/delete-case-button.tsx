import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCase } from "@/lib/cases.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function DeleteCaseButton({
  caseId,
  reference,
  variant = "icon",
  redirectToList = false,
}: {
  caseId: string;
  reference: string;
  variant?: "icon" | "button";
  redirectToList?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: () => deleteCase({ data: { id: caseId } }),
    onSuccess: async () => {
      toast.success(`Case ${reference} deleted`);
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["maintenance_cases"] });
      if (redirectToList) navigate({ to: "/cases" });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Could not delete this case");
    },
  });

  return (
    <>
      <button
        type="button"
        aria-label={`Delete case ${reference}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          variant === "icon"
            ? "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            : "inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
        }
      >
        <Trash2 className="h-4 w-4" />
        {variant === "button" && <span>Delete</span>}
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete case {reference}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the case, its AI summary and transcript from Ovelo. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {mutation.isPending ? "Deleting…" : "Delete case"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
