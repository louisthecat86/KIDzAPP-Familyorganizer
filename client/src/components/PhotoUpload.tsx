import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PhotoUploadProps {
  taskId: number;
  onUploadSuccess: (proof: string) => void;
  disabled?: boolean;
}

export function PhotoUpload({ taskId, onUploadSuccess, disabled = false }: PhotoUploadProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const { toast } = useToast();

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Kamera konnte nicht geöffnet werden",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
    }
    setShowCamera(false);
    setPreview(null);
  };

  const capturePhoto = () => {
    if (canvasRef.current && videoRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        const imageData = canvasRef.current.toDataURL("image/jpeg", 0.8);
        setPreview(imageData);
      }
    }
  };

  const uploadPhoto = async () => {
    if (!preview) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}/proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proof: preview }),
      });

      if (!res.ok) throw new Error("Upload fehlgeschlagen");

      const data = await res.json();
      onUploadSuccess(data.proof);
      setShowCamera(false);
      setPreview(null);
      toast({
        title: "Erfolg",
        description: "Foto hochgeladen!",
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const compressImage = (imageData: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = imageData;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Resize if image is too large (max 1280px)
        const maxSize = 1280;
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Compress with 60% quality
          resolve(canvas.toDataURL("image/jpeg", 0.6));
        } else {
          resolve(imageData);
        }
      };
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const imageData = event.target?.result as string;
      try {
        // Compress the image
        const compressedData = await compressImage(imageData);
        
        const res = await fetch(`/api/tasks/${taskId}/proof`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proof: compressedData }),
        });

        if (!res.ok) throw new Error("Upload fehlgeschlagen");

        const data = await res.json();
        onUploadSuccess(data.proof);
        toast({
          title: "Erfolg",
          description: "Foto hochgeladen!",
        });
      } catch (error) {
        toast({
          title: "Fehler",
          description: (error as Error).message,
          variant: "destructive",
        });
      }
    };
    reader.readAsDataURL(file);
  };

  if (showCamera) {
    return (
      <div className="w-full bg-black rounded-lg overflow-hidden" data-testid="camera-container">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-auto"
          data-testid="camera-video"
        />
        <canvas ref={canvasRef} style={{ display: "none" }} data-testid="camera-canvas" />

        {preview && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <img src={preview} alt="preview" className="max-w-full max-h-full" />
          </div>
        )}

        <div className="flex gap-2 p-4 bg-black/80">
          {!preview ? (
            <>
              <Button
                onClick={capturePhoto}
                className="flex-1 bg-primary"
                data-testid="button-capture-photo"
              >
                <Camera className="h-4 w-4 mr-2" /> Foto machen
              </Button>
              <Button
                onClick={stopCamera}
                variant="outline"
                className="flex-1"
                data-testid="button-close-camera"
              >
                <X className="h-4 w-4 mr-2" /> Abbrechen
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={uploadPhoto}
                className="flex-1 bg-primary"
                data-testid="button-upload-photo"
              >
                <Upload className="h-4 w-4 mr-2" /> Hochladen
              </Button>
              <Button
                onClick={() => setPreview(null)}
                variant="outline"
                className="flex-1"
                data-testid="button-retake-photo"
              >
                <Camera className="h-4 w-4 mr-2" /> Nochmal
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 w-full" data-testid="photo-upload-buttons">
      <Button
        onClick={() => fileInputRef.current?.click()}
        variant="outline"
        className="w-full"
        disabled={disabled}
        data-testid="button-upload-file"
      >
        <Upload className="h-4 w-4 mr-2" /> Foto hochladen
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="file-input"
      />
    </div>
  );
}
