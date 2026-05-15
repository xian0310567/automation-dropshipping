import { monitoringScreens } from "../monitoring-data";
import { MonitoringTableScreen } from "../monitoring-table-screen";

export default function ProductsPage() {
  return <MonitoringTableScreen screen={monitoringScreens.products} />;
}
