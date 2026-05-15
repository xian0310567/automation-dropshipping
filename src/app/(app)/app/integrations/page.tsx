import { monitoringScreens } from "../monitoring-data";
import { MonitoringTableScreen } from "../monitoring-table-screen";

export default function IntegrationsPage() {
  return <MonitoringTableScreen screen={monitoringScreens.suppliers} />;
}
