'use client';

import { createContext, ReactNode, useContext, useState } from 'react';

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

const Tabs: React.FC<{ children: ReactNode }> = ({ children }) => {
  return <TabsProvider>{children}</TabsProvider>;
};

const TabList: React.FC<{ children: ReactNode }> = ({ children }) => {
  return <div role="tablist">{children}</div>;
};

interface TabProps {
  tabId: string;
  children: React.ReactNode;
}

const Tab: React.FC<TabProps> = ({ tabId, children }) => {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === tabId;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setActiveTab(tabId)}
      className={`${isActive ? 'bg-blue-500 text-white' : 'tex-black bg-white'} mx-1 rounded-md px-4 py-2`}
    >
      {children}
    </button>
  );
};

interface TanPanelProps {
  tabId: string;
  children: React.ReactNode;
}

const TabPanel: React.FC<TanPanelProps> = ({ tabId, children }) => {
  const { activeTab } = useTabsContext();

  if (activeTab !== tabId) {
    return null;
  }

  return <div role="tabpenel">{children}</div>;
};

export { Tabs, TabList, Tab, TabPanel };
