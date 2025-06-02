
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

interface MeetingExitDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  meetingId?: string;
}

export function MeetingExitDialog({ 
  isOpen, 
  onConfirm, 
  onCancel, 
  meetingId 
}: MeetingExitDialogProps) {
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave Meeting?</AlertDialogTitle>
          <AlertDialogDescription>
            You are currently in a Zoom meeting{meetingId ? ` (${meetingId})` : ''}. 
            Leaving this page will end your participation in the meeting.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Stay in Meeting
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">
            Leave Meeting
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
