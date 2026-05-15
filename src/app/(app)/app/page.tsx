import { monitoringScreens } from "./monitoring-data";
import { MonitoringTableScreen } from "./monitoring-table-screen";

export default function Home() {
  return <MonitoringTableScreen screen={monitoringScreens.today} />;
}
