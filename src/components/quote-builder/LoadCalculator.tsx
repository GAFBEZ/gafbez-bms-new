import { Plus, Trash2 } from "lucide-react";
import type { LoadCalculatorAppliance, QuoteLoadCalc, QuoteSystemType } from "@/types";
import PrintValue from "./PrintValue";
import NumberInput from "./NumberInput";
import CompanyIdentity from "./CompanyIdentity";
import type { QuoteBranding } from "./BusinessHeader";

/** Most inverters are only ~80% efficient at converting their rated kVA
 * into real usable watts (the rest is reactive power) -- this is the
 * standard rule of thumb installers already use when sizing a system,
 * not a config value staff need to tune per quote. */
const INVERTER_POWER_FACTOR = 0.8;

/** Lithium batteries are commonly specced to not discharge below 20% state
 * of charge (to protect battery health/lifespan), so only 80% of rated
 * capacity is treated as usable backup energy. */
const USABLE_DOD_FRACTION = 0.8;

const fieldClasses =
  "w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30 print:hidden";
const labelClasses = "text-xs font-semibold text-gray-500 print:hidden";

/** Typical Nigerian household/office wattages -- a starting point only.
 * Every value lands in an editable NumberInput once added, since actual
 * appliance ratings vary by brand/model and staff know theirs from the
 * catalogue if unsure. */
const APPLIANCE_PRESETS: { name: string; wattage: number }[] = [
  { name: "LED Bulb", wattage: 10 },
  { name: "Ceiling Fan", wattage: 75 },
  { name: "Standing Fan", wattage: 60 },
  { name: "Television (32\"-50\" LED)", wattage: 120 },
  { name: "Refrigerator (Medium)", wattage: 150 },
  { name: "Chest Freezer", wattage: 200 },
  { name: "Air Conditioner (1HP)", wattage: 900 },
  { name: "Air Conditioner (1.5HP)", wattage: 1100 },
  { name: "Air Conditioner (2HP)", wattage: 1500 },
  { name: "Washing Machine", wattage: 500 },
  { name: "Microwave Oven", wattage: 1200 },
  { name: "Electric Iron", wattage: 1000 },
  { name: "Electric Kettle", wattage: 1500 },
  { name: "Water Dispenser", wattage: 100 },
  { name: "Water Pump (0.5HP)", wattage: 370 },
  { name: "Laptop / Charger", wattage: 65 },
  { name: "Desktop Computer", wattage: 200 },
  { name: "Wi-Fi Router", wattage: 15 },
  { name: "Sound System / Home Theatre", wattage: 150 },
  { name: "CCTV System (per channel)", wattage: 20 },
];

interface LoadCalculatorProps {
  value: QuoteLoadCalc;
  onChange: (value: QuoteLoadCalc) => void;
  systemType: QuoteSystemType;
  onAutoFill: () => void;
  branding: QuoteBranding;
}

function newAppliance(): LoadCalculatorAppliance {
  return { id: crypto.randomUUID(), name: "", wattage: 0, quantity: 1, dailyHours: 1 };
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-t-4 border-gray-200 border-t-brand-gold bg-gray-50 px-3 py-2 print:rounded-none print:border print:border-brand-green/30 print:border-t-4 print:border-t-brand-gold print:bg-gray-50">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-black">{label}</p>
      <p className="text-sm font-bold text-brand-green">{value}</p>
    </div>
  );
}

export default function LoadCalculator({ value, onChange, systemType, onAutoFill, branding }: LoadCalculatorProps) {
  const appliances = value.appliances;
  const hasContent = appliances.length > 0 || Boolean(value.inverterSizeKva || value.batteryCapacityKwh || value.solarArrayKw);

  function updateAppliance(id: string, patch: Partial<LoadCalculatorAppliance>) {
    onChange({ ...value, appliances: appliances.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  }

  function handleQuickAdd(presetName: string) {
    const preset = APPLIANCE_PRESETS.find((p) => p.name === presetName);
    if (!preset) return;
    onChange({
      ...value,
      appliances: [
        ...appliances,
        { id: crypto.randomUUID(), name: preset.name, wattage: preset.wattage, quantity: 1, dailyHours: 1 },
      ],
    });
  }

  const totalLoadW = appliances.reduce((sum, a) => sum + a.wattage * a.quantity, 0);
  const totalDailyEnergyWh = appliances.reduce((sum, a) => sum + a.wattage * a.quantity * a.dailyHours, 0);

  const approxInverterLimitW = value.inverterSizeKva ? value.inverterSizeKva * 1000 * INVERTER_POWER_FACTOR : null;
  const usableBatteryEnergyWh = value.batteryCapacityKwh ? value.batteryCapacityKwh * 1000 * USABLE_DOD_FRACTION : null;
  const estimatedBackupHours = usableBatteryEnergyWh && totalLoadW > 0 ? usableBatteryEnergyWh / totalLoadW : null;

  return (
    <div
      className={`flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 print:rounded-none print:border-none print:p-0 ${
        hasContent ? "print:break-before-page" : "print:hidden"
      }`}
    >
      {/* print:break-inside-avoid guards against the "must start on a new
       * page" rule above sometimes not being honored right at this exact
       * boundary on some mobile print engines -- without it, the logo can
       * start laying out at the bottom of the previous page and get
       * physically cropped by the page edge instead of moving over
       * cleanly. This keeps the logo+heading as one atomic unit, so worst
       * case it jumps to the next page whole rather than splitting. */}
      <div className="hidden print:flex print:flex-col print:items-center print:gap-2.5 print:break-inside-avoid print:border-b-4 print:border-brand-gold print:pb-2 print:text-center">
        <CompanyIdentity branding={branding} />
      </div>

      <div className="flex flex-col items-center gap-2 border-b-2 border-brand-gold pb-3 text-center print:break-inside-avoid">
        <h3 className="text-lg font-bold uppercase tracking-wide text-brand-green">
          Load Analysis / Estimated Backup Overview
        </h3>
        <button
          type="button"
          onClick={onAutoFill}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-brand-green transition-colors hover:bg-green-50 print:hidden"
        >
          Auto-fill From Quote
        </button>
      </div>

      <div
        className={`mt-3 grid grid-cols-2 gap-3 print:mt-2 print:gap-2 ${
          systemType === "full_system" ? "sm:grid-cols-4 print:grid-cols-4" : "sm:grid-cols-3 print:grid-cols-3"
        }`}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="inverterSize" className={labelClasses}>
            Inverter Size (kVA)
          </label>
          <NumberInput
            id="inverterSize"
            min={0}
            step="0.1"
            value={value.inverterSizeKva ?? 0}
            onChange={(n) => onChange({ ...value, inverterSizeKva: n || null })}
            className={fieldClasses}
          />
          <div className="hidden print:block">
            <StatCard label="Inverter Size" value={value.inverterSizeKva ? `${value.inverterSizeKva} kVA` : "--"} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="batteryCapacity" className={labelClasses}>
            Battery Capacity (kWh)
          </label>
          <NumberInput
            id="batteryCapacity"
            min={0}
            value={value.batteryCapacityKwh ?? 0}
            onChange={(n) => onChange({ ...value, batteryCapacityKwh: n || null })}
            className={fieldClasses}
          />
          <div className="hidden print:block">
            <StatCard label="Battery Capacity" value={value.batteryCapacityKwh ? `${value.batteryCapacityKwh} kWh` : "--"} />
          </div>
        </div>
        {systemType === "full_system" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="solarArray" className={labelClasses}>
              Solar Array (W)
            </label>
            <NumberInput
              id="solarArray"
              min={0}
              value={value.solarArrayKw ?? 0}
              onChange={(n) => onChange({ ...value, solarArrayKw: n || null })}
              className={fieldClasses}
            />
            <div className="hidden print:block">
              <StatCard label="Solar Array" value={value.solarArrayKw ? `${value.solarArrayKw} W` : "--"} />
            </div>
          </div>
        )}
        <div className="hidden print:flex print:flex-col print:justify-end">
          <StatCard label="Total Running Load" value={`${totalLoadW.toLocaleString()} W`} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 print:overflow-visible print:rounded-none print:border-brand-green/40">
        <table className="min-w-full divide-y divide-gray-100 text-sm print:w-full print:table-fixed print:border-collapse print:divide-y-0">
          <thead>
            <tr className="bg-amber-50 text-left text-xs font-bold uppercase tracking-wide text-brand-green">
              <th className="w-10 px-3 py-2 print:w-[6%] print:border print:border-brand-green/30 print:px-2 print:py-1">S/N</th>
              <th className="px-3 py-2 print:w-[34%] print:border print:border-brand-green/30 print:px-2 print:py-1">Appliance</th>
              <th className="w-24 px-3 py-2 print:w-[15%] print:border print:border-brand-green/30 print:px-2 print:py-1">Watts</th>
              <th className="w-20 px-3 py-2 print:w-[12%] print:border print:border-brand-green/30 print:px-2 print:py-1">Qty</th>
              <th className="w-28 px-3 py-2 print:w-[16%] print:border print:border-brand-green/30 print:px-2 print:py-1">Hrs/Day</th>
              <th className="w-28 px-3 py-2 print:w-[17%] print:border print:border-brand-green/30 print:px-2 print:py-1">Daily Wh</th>
              <th className="w-10 px-3 py-2 print:hidden" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 print:divide-y-0">
            {appliances.map((appliance, index) => (
              <tr
                key={appliance.id}
                className={`break-inside-avoid ${index % 2 === 1 ? "bg-gray-50 print:bg-gray-50" : ""}`}
              >
                <td className="px-3 py-2 font-semibold text-black print:border print:border-brand-green/20 print:px-2 print:py-1">
                  {index + 1}
                </td>
                <td className="px-3 py-2 print:border print:border-brand-green/20 print:px-2 print:py-1">
                  <input
                    type="text"
                    value={appliance.name}
                    onChange={(e) => updateAppliance(appliance.id, { name: e.target.value })}
                    placeholder="e.g. Fridge"
                    className={fieldClasses}
                  />
                  <PrintValue className="text-black">{appliance.name || "--"}</PrintValue>
                </td>
                <td className="px-3 py-2 print:border print:border-brand-green/20 print:px-2 print:py-1">
                  <NumberInput
                    min={0}
                    value={appliance.wattage}
                    onChange={(wattage) => updateAppliance(appliance.id, { wattage })}
                    className={fieldClasses}
                  />
                  <PrintValue className="text-black">{appliance.wattage}</PrintValue>
                </td>
                <td className="px-3 py-2 print:border print:border-brand-green/20 print:px-2 print:py-1">
                  <NumberInput
                    min={0}
                    value={appliance.quantity}
                    onChange={(quantity) => updateAppliance(appliance.id, { quantity })}
                    className={fieldClasses}
                  />
                  <PrintValue className="text-black">{appliance.quantity}</PrintValue>
                </td>
                <td className="px-3 py-2 print:border print:border-brand-green/20 print:px-2 print:py-1">
                  <NumberInput
                    min={0}
                    value={appliance.dailyHours}
                    onChange={(dailyHours) => updateAppliance(appliance.id, { dailyHours })}
                    className={fieldClasses}
                  />
                  <PrintValue className="text-black">{appliance.dailyHours}</PrintValue>
                </td>
                <td className="px-3 py-2 font-bold text-brand-green print:border print:border-brand-green/20 print:px-2 print:py-1">
                  {(appliance.wattage * appliance.quantity * appliance.dailyHours).toLocaleString()}
                </td>
                <td className="px-3 py-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => onChange({ ...value, appliances: appliances.filter((a) => a.id !== appliance.id) })}
                    aria-label="Remove appliance"
                    className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <select
          value=""
          onChange={(e) => handleQuickAdd(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-brand-green focus:border-brand-green focus:outline-none"
        >
          <option value="">+ Quick add common appliance…</option>
          {APPLIANCE_PRESETS.map((preset) => (
            <option key={preset.name} value={preset.name}>
              {preset.name} ({preset.wattage}W)
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onChange({ ...value, appliances: [...appliances, newAppliance()] })}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-semibold text-brand-green transition-colors hover:bg-green-50"
        >
          <Plus className="h-4 w-4" />
          Add Custom Appliance
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 text-sm sm:flex sm:flex-wrap sm:justify-end sm:gap-x-6 sm:gap-y-1 print:hidden">
        <span className="text-gray-500">
          Total Running Load: <strong className="text-gray-900">{totalLoadW.toLocaleString()} W</strong>
        </span>
        <span className="text-gray-500">
          Total Daily Energy: <strong className="text-gray-900">{(totalDailyEnergyWh / 1000).toFixed(2)} kWh</strong>
        </span>
      </div>
      <div className="hidden grid-cols-2 gap-2 sm:grid-cols-4 print:grid print:grid-cols-4">
        <StatCard label="Total Daily Energy" value={`${totalDailyEnergyWh.toLocaleString()} Wh`} />
        <StatCard label="Approx. Inverter Limit" value={approxInverterLimitW ? `${Math.round(approxInverterLimitW).toLocaleString()} W` : "--"} />
        <StatCard label="Usable Battery Energy" value={usableBatteryEnergyWh ? `${Math.round(usableBatteryEnergyWh).toLocaleString()} Wh` : "--"} />
        <StatCard label="Estimated Backup Time" value={estimatedBackupHours ? `${estimatedBackupHours.toFixed(1)} hours` : "--"} />
      </div>
      <p className="hidden text-[11px] text-black print:block">
        <span className="font-bold text-red-600">NOTE:</span> This load analysis is an estimate for client guidance
        only. Actual runtime depends on battery state of charge, depth of discharge setting, inverter efficiency,
        starting surge of appliances, weather conditions and usage pattern. Heavy loads such as air conditioners,
        heaters, pumping machines, pressing iron, microwave and kettles should be evaluated separately before final
        approval.
      </p>
    </div>
  );
}
