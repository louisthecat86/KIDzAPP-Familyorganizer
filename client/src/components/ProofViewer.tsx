import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye } from "lucide-react";

interface ProofViewerProps {
  proof?: string;
  taskTitle: string;
}

export function ProofViewer({ proof, taskTitle }: ProofViewerProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!proof) {
    return null;
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="sm"
        className="gap-2"
        data-testid="button-view-proof"
      >
        <Eye className="h-4 w-4" /> Beweis ansehen
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-proof-viewer">
          <DialogHeader>
            <DialogTitle>Beweis für: {taskTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center bg-black/50 rounded-lg p-4 max-h-96">
            <img
              src={proof}
              alt={`Beweis für ${taskTitle}`}
              className="max-w-full max-h-96 rounded-lg object-contain"
              data-testid="image-proof"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
