import { monitoringScreens } from "../monitoring-data";
import { MonitoringTableScreen } from "../monitoring-table-screen";

export default function HistoryPage() {
  return <MonitoringTableScreen screen={monitoringScreens.history} />;
}
