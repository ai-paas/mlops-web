'use client';

import { createContext, HTMLAttributes, ReactNode, useContext, useState } from 'react';
import { cn } from '../../lib/utils';

/* -------------------------------------------------------------------------------------------------
 * TabsContext
 * -----------------------------------------------------------------------------------------------*/
interface TabsContextType {
  activeTab: string;
  setActiveTab: (tabId: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

const TabsProvider = ({ children }: { children: ReactNode }) => {
  const [activeTab, setActiveTab] = useState('tab1');
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>{children}</TabsContext.Provider>
  );
};

const useTabsContext = () => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('useTabsContext must be used within a TabsProvider');
  }
  return context;
};

/* -------------------------------------------------------------------------------------------------
 * Tabs
 * -----------------------------------------------------------------------------------------------*/

interface TabsProps {
  children: React.ReactNode;
}

const Tabs = ({ children }: TabsProps) => {
  return (
    <TabsProvider>
      <div>{children}</div>
    </TabsProvider>
  );
};

const TabList = ({ children }: { children: ReactNode }) => {
  return <div role="tablist">{children}</div>;
};

interface TabProps extends HTMLAttributes<HTMLButtonElement> {
  tabId: string;
  children: React.ReactNode;
}

const Tab = ({ tabId, children, className, ...props }: TabProps) => {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === tabId;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setActiveTab(tabId)}
      className={cn(
        `mx-1 rounded-md px-4 py-2 transition-colors`,
        isActive ? `text-white ${className || 'bg-blue-500'}` : 'bg-white text-black'
      )}
      {...props}
    >
      {children}
    </button>
  );
};

interface TabPanelProps {
  tabId: string;
  children: React.ReactNode;
}

const TabPanel = ({ tabId, children }: TabPanelProps) => {
  const { activeTab } = useTabsContext();

  if (activeTab !== tabId) {
    return null;
  }

  return <div role="tabpanel">{children}</div>;
};

export { Tabs, TabList, Tab, TabPanel };
