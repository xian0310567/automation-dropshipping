import { monitoringScreens } from "../monitoring-data";
import { MonitoringTableScreen } from "../monitoring-table-screen";

export default function MarginsPage() {
  return <MonitoringTableScreen screen={monitoringScreens.margins} />;
}
