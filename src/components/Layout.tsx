
import React, { ReactNode } from "react";
import { SidebarDemo } from "./SidebarDemo";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="h-screen w-full overflow-hidden">
      <SidebarDemo>
        {children}
      </SidebarDemo>
    </div>
  );
};

export default Layout;
