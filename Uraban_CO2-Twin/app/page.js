'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Factory,
  TreePine,
  Recycle,
  Wind,
  Building2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CircleSlash,
  Leaf,
  DollarSign,
  Gauge,
} from 'lucide-react';

// --- CONFIGURATION ---
const GRID_SIZE = 25;
const BASE_EMISSION_RATE = 100;
const DISPERSION_FACTOR = 0.85; // How much CO2 spreads to neighbors
const WIND_STRENGTH = 0.5; // How much wind affects dispersion direction (0 to 1)

const EMISSION_SOURCES = [
  // Factories
  {
    id: 'factory-1',
    x: 4,
    y: 5,
    type: 'factory',
    emission: BASE_EMISSION_RATE * 2.5,
  },
  {
    id: 'factory-2',
    x: 20,
    y: 21,
    type: 'factory',
    emission: BASE_EMISSION_RATE * 2.2,
  },
  // Commercial District
  {
    id: 'commercial-1',
    x: 18,
    y: 6,
    type: 'commercial',
    emission: BASE_EMISSION_RATE * 1.8,
  },
  // Roads (Highways)
  ...Array.from({ length: 25 }).map((_, i) => ({
    id: `traffic-h-main-${i}`,
    x: i,
    y: 12,
    type: 'traffic',
    emission: BASE_EMISSION_RATE * (0.8 + Math.random() * 0.4),
  })),
  ...Array.from({ length: 25 }).map((_, i) => ({
    id: `traffic-v-main-${i}`,
    x: 10,
    y: i,
    type: 'traffic',
    emission: BASE_EMISSION_RATE * (0.9 + Math.random() * 0.5),
  })),
  // Secondary Road
  ...Array.from({ length: 10 }).map((_, i) => ({
    id: `traffic-h-secondary-${i}`,
    x: 15 + i,
    y: 3,
    type: 'traffic',
    emission: BASE_EMISSION_RATE * 0.6,
  })),
];

const CAPTURE_UNITS = {
  roadsideScrubber: {
    name: 'Roadside Scrubber',
    icon: Wind,
    captureRate: 45,
    radius: 2,
    color: 'bg-cyan-600',
    cost: 50000,
  },
  verticalGarden: {
    name: 'Vertical Garden',
    icon: TreePine,
    captureRate: 25,
    radius: 3,
    color: 'bg-green-600',
    cost: 25000,
  },
  industrialBiofilter: {
    name: 'Industrial Biofilter',
    icon: Recycle,
    captureRate: 90,
    radius: 4,
    color: 'bg-indigo-600',
    cost: 120000,
  },
};

// --- HELPER FUNCTIONS ---
const getSourceIcon = (type) => {
  switch (type) {
    case 'factory':
      return (
        <Factory className="w-6 h-6 text-yellow-300 drop-shadow-[0_0_5px_rgba(252,211,77,0.8)]" />
      );
    case 'commercial':
      return (
        <Building2 className="w-6 h-6 text-blue-300 drop-shadow-[0_0_5px_rgba(96,165,250,0.8)]" />
      );
    default:
      return null;
  }
};

const getCO2Color = (value) => {
  if (value <= 5) return 'rgba(0, 0, 0, 0)';
  const maxCO2 = BASE_EMISSION_RATE * 2.5;
  const percentage = Math.min(value / maxCO2, 1);
  const hue = (1 - percentage) * 60;
  const saturation = percentage * 100;
  const lightness = 40 + percentage * 10;
  const alpha = 0.2 + percentage * 0.6;
  return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
};

// --- CORE SIMULATION LOGIC ---
const computeCO2Grid = (sources, placedUnits, windDirection) => {
  let grid = Array(GRID_SIZE)
    .fill(null)
    .map(() => Array(GRID_SIZE).fill(0));
  let queue = [];
  sources.forEach((source) => {
    if (
      source.x >= 0 &&
      source.x < GRID_SIZE &&
      source.y >= 0 &&
      source.y < GRID_SIZE
    ) {
      grid[source.y][source.x] = Math.max(
        grid[source.y][source.x],
        source.emission
      );
      queue.push({ x: source.x, y: source.y, emission: source.emission });
    }
  });
  let head = 0;
  while (head < queue.length) {
    const { x, y, emission } = queue[head++];
    if (emission * DISPERSION_FACTOR <= 1) continue;
    const neighbors = [
      { dx: 1, dy: 0, direction: 'E' },
      { dx: -1, dy: 0, direction: 'W' },
      { dx: 0, dy: 1, direction: 'S' },
      { dx: 0, dy: -1, direction: 'N' },
    ];
    for (const neighbor of neighbors) {
      let modifiedDispersion = DISPERSION_FACTOR;
      if (windDirection) {
        if (windDirection === neighbor.direction) {
          modifiedDispersion *= 1 + WIND_STRENGTH;
        } else if (
          (windDirection === 'N' && neighbor.direction === 'S') ||
          (windDirection === 'S' && neighbor.direction === 'N') ||
          (windDirection === 'E' && neighbor.direction === 'W') ||
          (windDirection === 'W' && neighbor.direction === 'E')
        ) {
          modifiedDispersion *= 1 - WIND_STRENGTH;
        }
      }
      const newEmission = emission * modifiedDispersion;
      if (newEmission <= 1) continue;
      const nx = x + neighbor.dx;
      const ny = y + neighbor.dy;
      if (
        nx >= 0 &&
        nx < GRID_SIZE &&
        ny >= 0 &&
        ny < GRID_SIZE &&
        grid[ny][nx] < newEmission
      ) {
        grid[ny][nx] = newEmission;
        queue.push({ x: nx, y: ny, emission: newEmission });
      }
    }
  }
  placedUnits.forEach((unit) => {
    const unitInfo = CAPTURE_UNITS[unit.type];
    if (!unitInfo) return;
    for (let i = -unitInfo.radius; i <= unitInfo.radius; i++) {
      for (let j = -unitInfo.radius; j <= unitInfo.radius; j++) {
        const targetX = unit.x + i;
        const targetY = unit.y + j;
        if (
          targetX >= 0 &&
          targetX < GRID_SIZE &&
          targetY >= 0 &&
          targetY < GRID_SIZE
        ) {
          const distance = Math.sqrt(i * i + j * j);
          if (distance <= unitInfo.radius) {
            const reduction =
              unitInfo.captureRate * (1 - distance / unitInfo.radius);
            grid[targetY][targetX] = Math.max(
              0,
              grid[targetY][targetX] - reduction
            );
          }
        }
      }
    }
  });
  return grid;
};

// --- UI COMPONENTS ---
const GridCell = ({ co2Value, isSource, sourceType, placedUnit, onClick }) => {
  const UnitIcon = placedUnit ? CAPTURE_UNITS[placedUnit.type].icon : null;
  return (
    <div
      onClick={onClick}
      className="relative w-full h-full border border-gray-800/20 flex items-center justify-center cursor-pointer transition-colors duration-100 ease-in-out group"
      style={{ backgroundColor: getCO2Color(co2Value) }}>
      {!isSource && !placedUnit && (
        <div className="absolute inset-0 bg-sky-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
      )}
      {isSource && (
        <div className="absolute z-10 animate-pulse-slow">
          {getSourceIcon(sourceType)}
        </div>
      )}
      {placedUnit && UnitIcon && (
        <div
          className={`absolute z-20 w-8 h-8 rounded-full flex items-center justify-center shadow-lg transform transition-transform duration-200 group-hover:scale-110 ${
            CAPTURE_UNITS[placedUnit.type].color
          } ring-2 ring-offset-1 ring-offset-gray-900 ${
            placedUnit.type === 'roadsideScrubber'
              ? 'ring-cyan-400'
              : placedUnit.type === 'verticalGarden'
              ? 'ring-green-400'
              : 'ring-indigo-400'
          }`}>
          <UnitIcon className="w-5 h-5 text-white" />
        </div>
      )}
    </div>
  );
};

const MapGrid = ({ co2Grid, placedUnits, onCellClick }) => {
  const isSourceAt = (x, y) =>
    EMISSION_SOURCES.find(
      (s) =>
        s.x === x &&
        s.y === y &&
        (s.type === 'factory' || s.type === 'commercial')
    );
  const getPlacedUnitAt = (x, y) =>
    placedUnits.find((u) => u.x === x && u.y === y);
  return (
    <div className="bg-gray-800 p-2 md:p-4 rounded-xl shadow-2xl overflow-hidden border border-gray-700">
      <div
        className="relative grid gap-0"
        style={{
          gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
          width: 'clamp(300px, 80vh, 700px)',
          height: 'clamp(300px, 80vh, 700px)',
        }}>
        <img
          src="https://t4.ftcdn.net/jpg/01/30/96/55/360_F_130965557_6BBHCbEMg7I8KZYRMRuu5aByrFMUMzdJ.jpg"
          className="absolute top-0 left-0 w-full h-full object-cover z-0 rounded-lg"
          alt="City map background"
        />
        <div className="absolute top-0 left-0 w-full h-full bg-black/40 z-0 rounded-lg"></div>
        {co2Grid.map((row, y) =>
          row.map((co2Value, x) => {
            const source = isSourceAt(x, y);
            const unit = getPlacedUnitAt(x, y);
            return (
              <div key={`${x}-${y}`} className="relative z-10">
                <GridCell
                  co2Value={co2Value}
                  isSource={!!source}
                  sourceType={source?.type}
                  placedUnit={unit}
                  onClick={() => onCellClick(x, y)}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const WindControl = ({ windDirection, setWindDirection }) => {
  return (
    <div className="bg-gray-800 p-5 rounded-lg shadow-inner border border-gray-700">
      <h3 className="text-xl font-semibold text-gray-200 mb-3 flex items-center">
        <Wind className="w-5 h-5 text-cyan-400 mr-2" /> Wind Control
      </h3>
      <div className="grid grid-cols-3 gap-2 w-48 mx-auto">
        <div></div>
        <button
          onClick={() => setWindDirection('N')}
          className={`p-3 rounded-full flex justify-center items-center transition-all duration-200 ease-in-out ${
            windDirection === 'N'
              ? 'bg-cyan-600 shadow-lg text-white'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
          }`}
          aria-label="Wind from North">
          <ArrowUp className="w-5 h-5" />
        </button>
        <div></div>
        <button
          onClick={() => setWindDirection('W')}
          className={`p-3 rounded-full flex justify-center items-center transition-all duration-200 ease-in-out ${
            windDirection === 'W'
              ? 'bg-cyan-600 shadow-lg text-white'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
          }`}
          aria-label="Wind from West">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => setWindDirection(null)}
          className={`p-3 rounded-full flex justify-center items-center transition-all duration-200 ease-in-out ${
            windDirection === null
              ? 'bg-red-600 shadow-lg text-white'
              : 'bg-gray-700 text-gray-400 hover:bg-red-700 hover:text-white'
          }`}
          aria-label="Calm winds">
          <CircleSlash className="w-5 h-5" />
        </button>
        <button
          onClick={() => setWindDirection('E')}
          className={`p-3 rounded-full flex justify-center items-center transition-all duration-200 ease-in-out ${
            windDirection === 'E'
              ? 'bg-cyan-600 shadow-lg text-white'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
          }`}
          aria-label="Wind from East">
          <ArrowRight className="w-5 h-5" />
        </button>
        <div></div>
        <button
          onClick={() => setWindDirection('S')}
          className={`p-3 rounded-full flex justify-center items-center transition-all duration-200 ease-in-out ${
            windDirection === 'S'
              ? 'bg-cyan-600 shadow-lg text-white'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
          }`}
          aria-label="Wind from South">
          <ArrowDown className="w-5 h-5" />
        </button>
        <div></div>
      </div>
      <p className="text-center text-xs text-gray-500 mt-3">
        Current: {windDirection ? `From ${windDirection}` : 'Calm'}
      </p>
    </div>
  );
};

const ControlPanel = ({
  selectedUnit,
  setSelectedUnit,
  totalCaptured,
  totalEmissions,
  totalInvestment,
  costPerUnitCaptured,
  captureStats,
  placedUnits,
  onReset,
  windDirection,
  setWindDirection,
}) => {
  const captureEfficiency =
    totalEmissions > 0 ? (totalCaptured / totalEmissions) * 100 : 0;
  return (
    <div className="bg-gray-900 text-white p-6 rounded-xl shadow-2xl w-full max-w-sm flex flex-col gap-6 border border-gray-700 font-inter">
      <div className="bg-gray-800 p-5 rounded-lg shadow-inner border border-gray-700">
        <h2 className="text-2xl font-bold text-cyan-400 mb-2 flex items-center">
          <Gauge className="w-6 h-6 mr-2 text-green-400" /> Dashboard
        </h2>
        <p className="text-sm text-gray-400 mb-4">Live Simulation Data</p>
        <div className="space-y-4">
          <div className="bg-gray-700/50 p-4 rounded-md border border-gray-600">
            <p className="text-gray-300 text-sm">
              Total CO₂ Emitted (Baseline)
            </p>
            <p className="text-2xl font-extrabold text-red-500">
              {totalEmissions.toFixed(0)} units
            </p>
          </div>
          <div className="bg-gray-700/50 p-4 rounded-md border border-gray-600">
            <p className="text-gray-300 text-sm">Total CO₂ Captured</p>
            <p className="text-2xl font-extrabold text-green-500">
              {totalCaptured.toFixed(0)} units
            </p>
          </div>
          <div className="bg-gray-700/50 p-4 rounded-md border border-gray-600">
            <p className="text-gray-300 text-sm mb-2">
              Overall Capture Efficiency
            </p>
            <div className="w-full bg-gray-600 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-green-400 to-cyan-500 h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${captureEfficiency}%` }}></div>
            </div>
            <p className="text-xl font-bold text-cyan-300 text-right mt-2">
              {captureEfficiency.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
      <WindControl
        windDirection={windDirection}
        setWindDirection={setWindDirection}
      />
      <div className="bg-gray-800 p-5 rounded-lg shadow-inner border border-gray-700">
        <h2 className="text-xl font-semibold text-gray-200 mb-4 flex items-center">
          <Leaf className="w-5 h-5 text-green-400 mr-2" /> Interventions
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Select a unit to place on the map.
        </p>
        <div className="space-y-3">
          {Object.entries(CAPTURE_UNITS).map(([key, unit]) => {
            const Icon = unit.icon;
            const isSelected = selectedUnit === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedUnit(isSelected ? null : key)}
                className={`w-full flex items-center p-3 rounded-lg border transition-all duration-200 ease-in-out ${
                  isSelected
                    ? `bg-gradient-to-r from-${
                        unit.color.split('-')[1]
                      }-500/30 to-${unit.color.split('-')[1]}-600/30 border-${
                        unit.color.split('-')[1]
                      }-400 ring-2 ring-${
                        unit.color.split('-')[1]
                      }-400 shadow-md`
                    : 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-gray-500'
                }`}>
                <div
                  className={`w-10 h-10 rounded-md flex items-center justify-center mr-4 shadow ${unit.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-left">{unit.name}</p>
                  <p className="text-xs text-gray-400 text-left">
                    Capture: {unit.captureRate} units | Radius: {unit.radius}{' '}
                    cells
                  </p>
                  <p className="text-xs text-gray-400 text-left">
                    Cost: ${unit.cost.toLocaleString()}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {placedUnits.length > 0 && (
        <div className="bg-gray-800 p-5 rounded-lg shadow-inner border border-gray-700">
          <h3 className="text-xl font-semibold text-gray-200 mb-3 flex items-center">
            <DollarSign className="w-5 h-5 text-yellow-400 mr-2" /> Financial
            Analysis
          </h3>
          <div className="space-y-3">
            <div className="bg-gray-700/50 p-3 rounded-md border border-gray-600">
              <p className="text-gray-300 text-sm">Total Investment</p>
              <p className="text-xl font-bold text-green-400">
                ${totalInvestment.toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-700/50 p-3 rounded-md border border-gray-600">
              <p className="text-gray-300 text-sm">
                Cost per Unit of CO₂ Captured
              </p>
              <p className="text-xl font-bold text-green-400">
                ${costPerUnitCaptured.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}
      {placedUnits.length > 0 && (
        <div className="bg-gray-800 p-5 rounded-lg shadow-inner border border-gray-700">
          <h3 className="text-xl font-semibold text-gray-200 mb-3 flex items-center">
            <Recycle className="w-5 h-5 text-indigo-400 mr-2" /> Capture
            Breakdown
          </h3>
          <div className="space-y-3">
            {Object.entries(captureStats.breakdown).map(([key, stats]) => {
              if (stats.count === 0) return null;
              const percentage =
                totalCaptured > 0 ? (stats.captured / totalCaptured) * 100 : 0;
              const unitInfo = CAPTURE_UNITS[key];
              return (
                <div
                  key={key}
                  className="bg-gray-700/50 p-3 rounded-md border border-gray-600">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-semibold text-gray-200">
                      {unitInfo.name} ({stats.count})
                    </span>
                    <span className="text-sm font-bold text-green-300">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-2.5">
                    <div
                      className={`${unitInfo.color} h-2.5 rounded-full transition-all duration-500 ease-out`}
                      style={{ width: `${percentage}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <button
        onClick={onReset}
        className="w-full mt-auto p-4 rounded-lg bg-red-700 hover:bg-red-600 active:bg-red-800 transition-all duration-200 ease-in-out font-bold text-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50">
        Reset Simulation
      </button>
    </div>
  );
};

// --- MAIN APP COMPONENT ---
export default function UrbanCarbonTwin() {
  const [placedUnits, setPlacedUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [windDirection, setWindDirection] = useState(null);

  const co2Grid = useMemo(
    () => computeCO2Grid(EMISSION_SOURCES, placedUnits, windDirection),
    [placedUnits, windDirection]
  );
  const totalEmissions = useMemo(() => {
    const initialGrid = computeCO2Grid(EMISSION_SOURCES, [], null);
    return initialGrid.flat().reduce((sum, val) => sum + val, 0);
  }, []);
  const totalCaptured = useMemo(() => {
    const initialTotal = totalEmissions;
    const currentTotal = co2Grid.flat().reduce((sum, val) => sum + val, 0);
    return Math.max(0, initialTotal - currentTotal);
  }, [co2Grid, totalEmissions]);
  const totalInvestment = useMemo(
    () =>
      placedUnits.reduce((sum, unit) => sum + CAPTURE_UNITS[unit.type].cost, 0),
    [placedUnits]
  );
  const costPerUnitCaptured = useMemo(
    () => (totalCaptured === 0 ? 0 : totalInvestment / totalCaptured),
    [totalInvestment, totalCaptured]
  );
  const captureStats = useMemo(() => {
    const initialGrid = computeCO2Grid(EMISSION_SOURCES, [], windDirection);
    let tempGrid = initialGrid.map((row) => [...row]);
    const breakdown = Object.keys(CAPTURE_UNITS).reduce((acc, key) => {
      acc[key] = { captured: 0, count: 0 };
      return acc;
    }, {});
    placedUnits.forEach((unit) => {
      const unitInfo = CAPTURE_UNITS[unit.type];
      if (!unitInfo) return;
      breakdown[unit.type].count++;
      for (let i = -unitInfo.radius; i <= unitInfo.radius; i++) {
        for (let j = -unitInfo.radius; j <= unitInfo.radius; j++) {
          const targetX = unit.x + i;
          const targetY = unit.y + j;
          if (
            targetX >= 0 &&
            targetX < GRID_SIZE &&
            targetY >= 0 &&
            targetY < GRID_SIZE
          ) {
            const distance = Math.sqrt(i * i + j * j);
            if (distance <= unitInfo.radius) {
              const potentialReduction =
                unitInfo.captureRate * (1 - distance / unitInfo.radius);
              const availableCO2 = tempGrid[targetY][targetX];
              const actualReduction = Math.min(
                potentialReduction,
                availableCO2
              );
              if (actualReduction > 0) {
                breakdown[unit.type].captured += actualReduction;
                tempGrid[targetY][targetX] -= actualReduction;
              }
            }
          }
        }
      }
    });
    return { breakdown };
  }, [placedUnits, windDirection]);
  const handleCellClick = useCallback(
    (x, y) => {
      if (!selectedUnit) return;
      const isOccupied =
        placedUnits.some((u) => u.x === x && u.y === y) ||
        EMISSION_SOURCES.some(
          (s) =>
            s.x === x &&
            s.y === y &&
            (s.type === 'factory' || s.type === 'commercial')
        );
      if (isOccupied) {
        console.log('Cannot place unit on an occupied cell.');
        return;
      }
      setPlacedUnits((prevUnits) => [
        ...prevUnits,
        { x, y, type: selectedUnit },
      ]);
    },
    [selectedUnit, placedUnits]
  );
  const handleReset = () => {
    setPlacedUnits([]);
    setSelectedUnit(null);
    setWindDirection(null);
  };

  return (
    <main className="bg-gray-950 min-h-screen text-white flex flex-col items-center justify-center p-4 sm:p-8 lg:p-12 font-sans">
      <style>{`
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
        @keyframes fade-in-down {
          0% { opacity: 0; transform: translateY(-20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-down {
          animation: fade-in-down 0.7s ease-out forwards;
        }
      `}</style>
      <div className="w-full max-w-7xl mx-auto">
        <header className="text-center mb-10 animate-fade-in-down">
          <h1 className="text-5xl md:text-6xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-green-300 via-cyan-400 to-blue-500 drop-shadow-lg leading-tight">
            Urban Carbon Twin
          </h1>
          <p className="text-gray-300 mt-3 text-lg font-light tracking-wide">
            A Digital Twin for Simulating CO₂ Capture in Urban Settings
          </p>
        </header>
        <div className="flex flex-col lg:flex-row gap-8 md:gap-10 justify-center items-center lg:items-stretch">
          <MapGrid
            co2Grid={co2Grid}
            placedUnits={placedUnits}
            onCellClick={handleCellClick}
          />
          <ControlPanel
            selectedUnit={selectedUnit}
            setSelectedUnit={setSelectedUnit}
            totalCaptured={totalCaptured}
            totalEmissions={totalEmissions}
            totalInvestment={totalInvestment}
            costPerUnitCaptured={costPerUnitCaptured}
            captureStats={captureStats}
            placedUnits={placedUnits}
            onReset={handleReset}
            windDirection={windDirection}
            setWindDirection={setWindDirection}
          />
        </div>
      </div>
      <footer className="text-center mt-12 text-gray-600 text-sm">
        <p>
          &copy; {new Date().getFullYear()} Team Lorem Ipsum. All rights
          reserved.
        </p>
      </footer>
    </main>
  );
}
