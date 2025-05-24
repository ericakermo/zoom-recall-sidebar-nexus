
import React, { useState } from 'react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Plus, ChevronLeft, ChevronRight, CircleCheck, X } from 'lucide-react';

const Calendar = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <div className="p-6 h-full">
      <div className="flex items-start gap-6 h-full">
        {/* Calendar on the left */}
        <div className="flex-shrink-0">
          <CalendarComponent 
            mode="single" 
            selected={date} 
            onSelect={setDate} 
            className="rounded-lg border border-border p-3 pointer-events-auto [&_.rdp-day_selected]:!bg-black [&_.rdp-day_selected]:!text-white [&_.rdp-day_selected:hover]:!bg-black [&_.rdp-day_selected:hover]:!text-white [&_button[aria-selected='true']]:!bg-black [&_button[aria-selected='true']]:!text-white [&_button[aria-selected='true']:hover]:!bg-black [&_button[aria-selected='true']:hover]:!text-white" 
          />
        </div>
        
        {/* Vertical line */}
        <div className="flex items-center h-full">
          <div className="w-0.5 h-[95%] bg-black opacity-20"></div>
        </div>
        
        {/* Right side content */}
        <div className="flex flex-col gap-4 flex-1">
          {/* Buttons section */}
          <div className="flex items-center gap-2 self-start">
            {/* Circle button with plus */}
            <Button size="icon" className="rounded-full bg-black hover:bg-black/80 text-white w-10 h-10">
              <Plus className="h-4 w-4" />
            </Button>

            {/* Chevron buttons */}
            <div className="flex gap-1">
              <Button size="icon" className="rounded-md bg-black hover:bg-black/80 text-white w-8 h-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Button size="icon" className="rounded-md bg-black hover:bg-black/80 text-white w-8 h-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Horizontal line below all buttons */}
          <div className="w-full h-px bg-black opacity-10"></div>

          {/* Alert components section */}
          <div className="flex flex-col gap-4">
            <Alert
              layout="row"
              isNotification
              className="min-w-[400px]"
              icon={
                <CircleCheck
                  className="text-emerald-500"
                  size={16}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              }
              action={
                <div className="flex items-center gap-3">
                  <Button size="sm">Undo</Button>
                  <Button
                    variant="ghost"
                    className="group -my-1.5 -me-2 size-8 shrink-0 p-0 hover:bg-transparent"
                    aria-label="Close banner"
                  >
                    <X
                      size={16}
                      strokeWidth={2}
                      className="opacity-60 transition-opacity group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </Button>
                </div>
              }
            >
              <div className="flex grow items-center justify-between gap-12">
                <p className="text-sm">You've made changes!</p>
              </div>
            </Alert>

            <Alert
              layout="row"
              isNotification
              className="min-w-[400px]"
              variant="warning"
              icon={
                <CircleCheck
                  className="text-amber-500"
                  size={16}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              }
              action={
                <div className="flex items-center gap-3">
                  <Button size="sm">Review</Button>
                  <Button
                    variant="ghost"
                    className="group -my-1.5 -me-2 size-8 shrink-0 p-0 hover:bg-transparent"
                    aria-label="Close banner"
                  >
                    <X
                      size={16}
                      strokeWidth={2}
                      className="opacity-60 transition-opacity group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </Button>
                </div>
              }
            >
              <div className="flex grow items-center justify-between gap-12">
                <p className="text-sm">Warning: Please review!</p>
              </div>
            </Alert>

            <Alert
              layout="row"
              isNotification
              className="min-w-[400px]"
              variant="info"
              icon={
                <CircleCheck
                  className="text-blue-500"
                  size={16}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              }
              action={
                <div className="flex items-center gap-3">
                  <Button size="sm">View</Button>
                  <Button
                    variant="ghost"
                    className="group -my-1.5 -me-2 size-8 shrink-0 p-0 hover:bg-transparent"
                    aria-label="Close banner"
                  >
                    <X
                      size={16}
                      strokeWidth={2}
                      className="opacity-60 transition-opacity group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </Button>
                </div>
              }
            >
              <div className="flex grow items-center justify-between gap-12">
                <p className="text-sm">New information available!</p>
              </div>
            </Alert>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
