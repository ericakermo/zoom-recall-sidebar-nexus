
import React, { ReactNode } from "react";
import { SidebarDemo } from "./SidebarDemo";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="h-screen w-full overflow-hidden">
      <SidebarDemo />
      <div className="absolute inset-0 md:left-[300px] md:w-[calc(100%-300px)] pt-10 md:pt-0 px-4 md:px-8 overflow-auto">
        <div className="max-w-screen-xl mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;
