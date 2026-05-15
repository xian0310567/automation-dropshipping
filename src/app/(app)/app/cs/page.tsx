import { monitoringScreens } from "../monitoring-data";
import { MonitoringTableScreen } from "../monitoring-table-screen";

export default function CsPage() {
  return <MonitoringTableScreen screen={monitoringScreens.cs} />;
}
