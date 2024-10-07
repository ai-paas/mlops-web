// import { Tab } from '@repo/ui';
import { Tabs, Tab, TabList, TabPanel } from '../../../../../../packages/ui/src/tab/tab';
export default function DashboardPage() {
  return (
    <main>
      <div className="h-40"></div>
      <Tabs>
        <TabList>
          <Tab className="bg-red-600 text-white" tabId="tab1">
            Tab 1
          </Tab>
          <Tab tabId="tab2">Tab 2</Tab>
          <Tab tabId="tab3">Tab 3</Tab>
        </TabList>
        <TabPanel tabId="tab1">Content for Tab 1</TabPanel>
        <TabPanel tabId="tab2">Content for Tab 2</TabPanel>
        <TabPanel tabId="tab3">Content for Tab 3</TabPanel>
      </Tabs>

      <div className="h-40"></div>
    </main>
  );
}
