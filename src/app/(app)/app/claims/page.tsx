import { monitoringScreens } from "../monitoring-data";
import { MonitoringTableScreen } from "../monitoring-table-screen";

export default function ClaimsPage() {
  return <MonitoringTableScreen screen={monitoringScreens.claims} />;
}
