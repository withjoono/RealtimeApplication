import { REGIONS } from '../constants/regions';
import type { RegionId } from '../constants/regions';

interface RegionSelectorProps {
  selectedRegion: RegionId;
  onRegionChange: (region: RegionId) => void;
}

export function RegionSelector({ selectedRegion, onRegionChange }: RegionSelectorProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🗺️</span>
        <h2 className="text-lg font-semibold text-gray-800">지역 선택</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {REGIONS.map((region) => (
          <button
            key={region.id}
            onClick={() => onRegionChange(region.id)}
            className={`
              px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
              ${selectedRegion === region.id
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-300 hover:border-orange-400 hover:text-orange-500'
              }
            `}
          >
            {region.name}
          </button>
        ))}
      </div>
    </div>
  );
}
