import React, { useState } from 'react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';

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
          <div className="w-px h-full bg-black opacity-10"></div>
        </div>
        
        {/* Buttons on the right */}
        <div className="flex flex-col gap-4 flex-1">
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
        </div>
      </div>
    </div>
  );
};

export default Calendar;
