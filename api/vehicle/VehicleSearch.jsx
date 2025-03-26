import { useState } from 'react';
import axiosInstance from '../../utils/axiosConfig';
import { useAuthContext } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';

const VehicleSearch = ({ onSelect, disabled }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
    };

    return (
        <div className="relative">
            <div className="relative">
                <input
                    type="text"
                    placeholder="Search vehicles by VIN, make, model..."
                    value={searchTerm}
                    onChange={handleSearch}
                    disabled={disabled}
                    className="w-full p-2 border rounded bg-gray-700 border-gray-600 text-white pr-8"
                />
                {loading && (
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                    </div>
                )}
            </div>
            
            {vehicles.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg max-h-60 overflow-y-auto">
                    {vehicles.map((vehicle) => (
                        <div
                            key={vehicle.vin}
                            onClick={() => onSelect(vehicle)}
                            className="p-2 hover:bg-gray-700 cursor-pointer text-white"
                        >
                            <div className="font-medium">
                                {`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                            </div>
                            <div className="text-sm text-gray-400">
                                VIN: {vehicle.vin}
                                {vehicle.customerName && ` • Owner: ${vehicle.customerName}`}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default VehicleSearch; 