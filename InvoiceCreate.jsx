import React, { useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useCustomer } from '../../context/CustomerContext';
import { useInvoice } from '../../context/invoiceContextCore';
import axiosInstance from '../../utils/axiosConfig';

// Constants for validation
const VALID_MAKES = ['bmw', 'mercedes', 'audi', 'volkswagen', 'ford', 'chevrolet', 
    'cadillac', 'gmc', 'chrysler', 'dodge', 'jeep', 'volvo', 'saab', 'porsche', 
    'lexus', 'mercury', 'buick', 'acura', 'lincoln', 'pontiac', 'honda', 'toyota', 
    'nissan', 'hyundai', 'kia', 'other'];

const VALID_ENGINES = ['4-cylinder', '6-cylinder', '8-cylinder', 'electric'];
const VALID_TRANSMISSIONS = ['automatic', 'manual', 'cvt', 'other'];

const InvoiceCreate = ({ onInvoiceCreated }) => {
    const { selectedCustomer, selectedVehicle } = useCustomer();
    const { createNewInvoice } = useInvoice();
    const [formData, setFormData] = React.useState({
        customerName: '',
        customerEmail: '',
        phoneNumber: '',
        address: '',
        city: '',
        zipCode: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        vehicleId: '',
        vehicleYear: '',
        vehicleMake: '',
        vehicleModel: '',
        vehicleVin: '',
        vehicleMileage: '',
        vehicleEngine: '',
        vehicleTransmission: '',
        notes: '',
        laborItems: [],
        partsItems: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        status: 'draft'
    });

    // Add state for available vehicles
    const [availableVehicles, setAvailableVehicles] = React.useState([]);

    // Validation function
    const validateInvoiceData = (data) => {
        const errors = [];

        if (!data.customerName || !data.customerEmail) {
            errors.push('Customer name and email are required');
        }

        if (data.vehicleMake && !VALID_MAKES.includes(data.vehicleMake.toLowerCase())) {
            errors.push(`Invalid vehicle make. Must be one of: ${VALID_MAKES.join(', ')}`);
        }

        if (data.vehicleEngine && !VALID_ENGINES.includes(data.vehicleEngine.toLowerCase())) {
            errors.push(`Invalid engine type. Must be one of: ${VALID_ENGINES.join(', ')}`);
        }

        if (data.vehicleTransmission && !VALID_TRANSMISSIONS.includes(data.vehicleTransmission.toLowerCase())) {
            errors.push(`Invalid transmission type. Must be one of: ${VALID_TRANSMISSIONS.join(', ')}`);
        }

        return errors;
    };

    // Fetch customer's vehicles when customer changes
    useEffect(() => {
        const fetchVehicles = async () => {
            if (selectedCustomer?._id) {
                try {
                    const response = await axiosInstance.get(`/customers/${selectedCustomer._id}/vehicles`);
                    setAvailableVehicles(response.data);
                    
                    // If there's a selectedVehicle, use it
                    if (selectedVehicle) {
                        handleVehicleSelect(selectedVehicle);
                    }
                } catch (error) {
                    console.error('Error fetching vehicles:', error);
                    toast.error('Failed to fetch customer vehicles');
                }
            }
        };
        fetchVehicles();
    }, [selectedCustomer, selectedVehicle]);

    // Handle vehicle selection with proper formatting
    const handleVehicleSelect = (vehicle) => {
        if (!vehicle) return;
        
        setFormData(prev => ({
            ...prev,
            vehicleId: vehicle._id,
            vehicleYear: vehicle.year || '',
            vehicleMake: (vehicle.make || '').toLowerCase(),
            vehicleModel: vehicle.model || '',
            vehicleVin: vehicle.vin || '',
            vehicleMileage: vehicle.mileage || '',
            vehicleEngine: (vehicle.engine || '').toLowerCase(),
            vehicleTransmission: (vehicle.transmission || '').toLowerCase()
        }));
    };

    const [newLaborItem, setNewLaborItem] = React.useState({
        description: '',
        hours: 0,
        ratePerHour: 0,
        shopSupplys: 0,
        technician: ''
    });

    const [newPartItem, setNewPartItem] = React.useState({
        partNumber: '',
        description: '',
        quantity: 1,
        price: 0
    });

    useEffect(() => {
        if (selectedCustomer) {
            const newInvoice = createNewInvoice();
            if (newInvoice) {
                setFormData(prev => ({
                    ...prev,
                    customerName: `${selectedCustomer.firstName} ${selectedCustomer.lastName}`,
                    customerEmail: selectedCustomer.email || '',
                    phoneNumber: selectedCustomer.phoneNumber || '',
                    address: selectedCustomer.address || '',
                    city: selectedCustomer.city || '',
                    zipCode: selectedCustomer.zipCode || '',
                    vehicleYear: newInvoice.vehicleYear || '',
                    vehicleMake: (newInvoice.vehicleMake || '').toLowerCase(),
                    vehicleModel: newInvoice.vehicleModel || '',
                    vehicleVin: newInvoice.vehicleVin || '',
                    vehicleMileage: newInvoice.vehicleMileage || '',
                    vehicleEngine: (newInvoice.vehicleEngine || '').toLowerCase(),
                    vehicleTransmission: (newInvoice.vehicleTransmission || '').toLowerCase()
                }));
            }
        }
    }, [selectedCustomer, createNewInvoice]);

    const calculateTotals = (data) => {
        const laborTotal = data.laborItems.reduce((sum, item) => 
            sum + (item.hours * item.ratePerHour), 0);
        
        const partsTotal = data.partsItems.reduce((sum, item) => 
            sum + (item.quantity * item.price), 0);
        
        const subtotal = laborTotal + partsTotal;
        const tax = subtotal * 0.07; // 7% tax rate
        const total = subtotal + tax;

        return { subtotal, tax, total };
    };

    const handleAddLaborItem = () => {
        if (!newLaborItem.description || newLaborItem.hours <= 0 || newLaborItem.ratePerHour <= 0) {
            toast.error('Please fill in all labor item fields');
            return;
        }

        const updatedFormData = {
            ...formData,
            laborItems: [...formData.laborItems, newLaborItem]
        };

        const totals = calculateTotals(updatedFormData);
        setFormData({ ...updatedFormData, ...totals });
        setNewLaborItem({ description: '', hours: 0, ratePerHour: 0, shopSupplys: 0, technician: '' });
    };

    const handleAddPartItem = () => {
        if (!newPartItem.description || !newPartItem.partNumber || newPartItem.price <= 0) {
            toast.error('Please fill in all part item fields');
            return;
        }

        const updatedFormData = {
            ...formData,
            partsItems: [...formData.partsItems, newPartItem]
        };

        const totals = calculateTotals(updatedFormData);
        setFormData({ ...updatedFormData, ...totals });
        setNewPartItem({ partNumber: '', description: '', quantity: 1, price: 0 });
    };

    const handleRemoveLaborItem = (index) => {
        const updatedFormData = {
            ...formData,
            laborItems: formData.laborItems.filter((_, i) => i !== index)
        };
        const totals = calculateTotals(updatedFormData);
        setFormData({ ...updatedFormData, ...totals });
    };

    const handleRemovePartItem = (index) => {
        const updatedFormData = {
            ...formData,
            partsItems: formData.partsItems.filter((_, i) => i !== index)
        };
        const totals = calculateTotals(updatedFormData);
        setFormData({ ...updatedFormData, ...totals });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate the data before sending
        const validationErrors = validateInvoiceData(formData);
        if (validationErrors.length > 0) {
            validationErrors.forEach(error => toast.error(error));
            return;
        }

        try {
            // Format the data before sending
            const invoiceData = {
                ...formData,
                // Ensure proper case for vehicle data
                vehicleMake: formData.vehicleMake.toLowerCase(),
                vehicleEngine: formData.vehicleEngine.toLowerCase(),
                vehicleTransmission: formData.vehicleTransmission.toLowerCase(),
                // Ensure required fields
                invoiceDate: formData.invoiceDate || new Date().toISOString().split('T')[0],
                status: formData.status || 'draft',
                // Calculate totals
                subtotal: formData.subtotal || 0,
                tax: formData.tax || 0,
                total: formData.total || 0
            };

            const response = await axiosInstance.post('/invoices/create', invoiceData);
            console.log('Invoice created successfully:', response.data);
            
            toast.success('Invoice created successfully!');
            if (onInvoiceCreated) onInvoiceCreated();
            
            // Reset form after successful creation
            setFormData({
                customerName: '',
                customerEmail: '',
                phoneNumber: '',
                address: '',
                city: '',
                zipCode: '',
                invoiceDate: new Date().toISOString().split('T')[0],
                vehicleId: '',
                vehicleYear: '',
                vehicleMake: '',
                vehicleModel: '',
                vehicleVin: '',
                vehicleMileage: '',
                vehicleEngine: '',
                vehicleTransmission: '',
                notes: '',
                laborItems: [],
                partsItems: [],
                subtotal: 0,
                tax: 0,
                total: 0,
                status: 'draft'
            });
        } catch (error) {
            console.error('Full error details:', error.response?.data || error);
            toast.error(error.response?.data?.error || 'Failed to create invoice');
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        // Convert vehicle-related fields to lowercase
        if (['vehicleMake', 'vehicleEngine', 'vehicleTransmission'].includes(name)) {
            setFormData(prev => ({ ...prev, [name]: value.toLowerCase() }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleStatusChange = (status) => {
        setFormData(prev => ({ ...prev, status }));
    };

    // ... Rest of your JSX remains the same ...
    return (
        <div className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Customer Information */}
                <div className="mb-4 p-4 bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-blue-500">
                    <h3 className="text-xl font-semibold text-blue-400 mb-4">Customer Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-300 mb-1">Customer Name</label>
                            <input
                                type="text"
                                name="customerName"
                                value={formData.customerName}
                                onChange={handleChange}
                                className="w-full p-2 bg-gray-700 border-gray-600 text-white rounded-lg"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-gray-300 mb-1">Email</label>
                            <input
                                type="email"
                                name="customerEmail"
                                value={formData.customerEmail}
                                onChange={handleChange}
                                className="w-full p-2 bg-gray-700 border-gray-600 text-white rounded-lg"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-gray-300 mb-1">Phone</label>
                            <input
                                type="tel"
                                name="phoneNumber"
                                value={formData.phoneNumber}
                                onChange={handleChange}
                                className="w-full p-2 bg-gray-700 border-gray-600 text-white rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-300 mb-1">Address</label>
                            <input
                                type="text"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                className="w-full p-2 bg-gray-700 border-gray-600 text-white rounded-lg"
                            />
                        </div>
                    </div>
                </div>

                {/* Vehicle Selection */}
                <div className="mb-4 p-4 bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-green-500">
                    <h3 className="text-xl font-semibold text-green-400 mb-4">Vehicle Selection</h3>
                    <select
                        className="w-full p-2 bg-gray-700 border-gray-600 text-white rounded-lg"
                        value={formData.vehicleId}
                        onChange={(e) => {
                            const vehicle = availableVehicles.find(v => v._id === e.target.value);
                            handleVehicleSelect(vehicle);
                        }}
                    >
                        <option value="">Select a Vehicle</option>
                        {availableVehicles.map((vehicle) => (
                            <option key={vehicle._id} value={vehicle._id}>
                                {vehicle.year} {vehicle.make} {vehicle.model} - {vehicle.vin}
                            </option>
                        ))}
                    </select>

                    {/* Vehicle Details Display */}
                    {formData.vehicleId && (
                        <div className="mt-4 grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-gray-300">Year/Make/Model</label>
                                <p className="text-white">{formData.vehicleYear} {formData.vehicleMake} {formData.vehicleModel}</p>
                            </div>
                            <div>
                                <label className="block text-gray-300">VIN</label>
                                <p className="text-white">{formData.vehicleVin}</p>
                            </div>
                            <div>
                                <label className="block text-gray-300">Mileage</label>
                                <p className="text-white">{formData.vehicleMileage}</p>
                            </div>
                            <div>
                                <label className="block text-gray-300">Engine</label>
                                <p className="text-white">{formData.vehicleEngine}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Labor Items Section */}
                <div className="mb-4 p-4 bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-yellow-500">
                    <h3 className="text-xl font-semibold text-yellow-400 mb-4">Labor</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-12 gap-2">
                            <input
                                type="text"
                                value={newLaborItem.description}
                                onChange={(e) => setNewLaborItem(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Description"
                                className="col-span-6 p-2 bg-gray-700 border-gray-600 text-white rounded-lg"
                            />
                            <input
                                type="number"
                                value={newLaborItem.hours}
                                onChange={(e) => setNewLaborItem(prev => ({ ...prev, hours: parseFloat(e.target.value) }))}
                                placeholder="Hours"
                                className="col-span-2 p-2 bg-gray-700 border-gray-600 text-white rounded-lg"
                            />
                            <input
                                type="number"
                                value={newLaborItem.ratePerHour}
                                onChange={(e) => setNewLaborItem(prev => ({ ...prev, ratePerHour: parseFloat(e.target.value) }))}
                                placeholder="Rate/Hour"
                                className="col-span-2 p-2 bg-gray-700 border-gray-600 text-white rounded-lg"
                            />
                            <button
                                type="button"
                                onClick={handleAddLaborItem}
                                className="col-span-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors"
                            >
                                Add Labor
                            </button>
                        </div>

                        {/* Labor Items List */}
                        {formData.laborItems.map((item, index) => (
                            <div key={index} className="grid grid-cols-12 gap-2 items-center bg-gray-700 p-2 rounded-lg">
                                <span className="col-span-6 text-white">{item.description}</span>
                                <span className="col-span-2 text-white">{item.hours} hrs</span>
                                <span className="col-span-2 text-white">${item.ratePerHour}/hr</span>
                                <span className="col-span-1 text-white">${item.hours * item.ratePerHour}</span>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveLaborItem(index)}
                                    className="col-span-1 text-red-500 hover:text-red-600"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Parts Items Section */}
                <div className="mb-4 p-4 bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-purple-500">
                    <h3 className="text-xl font-semibold text-purple-400 mb-4">Parts</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-12 gap-2">
                            <input
                                type="text"
                                value={newPartItem.partNumber}
                                onChange={(e) => setNewPartItem(prev => ({ ...prev, partNumber: e.target.value }))}
                                placeholder="Part Number"
                                className="col-span-2 p-2 bg-gray-700 border-gray-600 text-white rounded-lg"
                            />
                            <input
                                type="text"
                                value={newPartItem.description}
                                onChange={(e) => setNewPartItem(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Description"
                                className="col-span-4 p-2 bg-gray-700 border-gray-600 text-white rounded-lg"
                            />
                            <input
                                type="number"
                                value={newPartItem.quantity}
                                onChange={(e) => setNewPartItem(prev => ({ ...prev, quantity: parseInt(e.target.value) }))}
                                placeholder="Qty"
                                className="col-span-2 p-2 bg-gray-700 border-gray-600 text-white rounded-lg"
                            />
                            <input
                                type="number"
                                value={newPartItem.price}
                                onChange={(e) => setNewPartItem(prev => ({ ...prev, price: parseFloat(e.target.value) }))}
                                placeholder="Price"
                                className="col-span-2 p-2 bg-gray-700 border-gray-600 text-white rounded-lg"
                            />
                            <button
                                type="button"
                                onClick={handleAddPartItem}
                                className="col-span-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
                            >
                                Add Part
                            </button>
                        </div>

                        {/* Parts Items List */}
                        {formData.partsItems.map((item, index) => (
                            <div key={index} className="grid grid-cols-12 gap-2 items-center bg-gray-700 p-2 rounded-lg">
                                <span className="col-span-2 text-white">{item.partNumber}</span>
                                <span className="col-span-4 text-white">{item.description}</span>
                                <span className="col-span-2 text-white">x{item.quantity}</span>
                                <span className="col-span-2 text-white">${item.price}</span>
                                <span className="col-span-1 text-white">${item.quantity * item.price}</span>
                                <button
                                    type="button"
                                    onClick={() => handleRemovePartItem(index)}
                                    className="col-span-1 text-red-500 hover:text-red-600"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Totals Section */}
                <div className="mb-4 p-4 bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-blue-500">
                    <div className="grid grid-cols-2 gap-4 text-white">
                        <div className="text-right">Subtotal:</div>
                        <div>${formData.subtotal.toFixed(2)}</div>
                        <div className="text-right">Tax (7%):</div>
                        <div>${formData.tax.toFixed(2)}</div>
                        <div className="text-right font-bold">Total:</div>
                        <div className="font-bold">${formData.total.toFixed(2)}</div>
                    </div>
                </div>

                {/* Status and Submit Section */}
                <div className="mb-4 p-4 bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-blue-500">
                    <div className="flex justify-between items-center">
                        <div className="space-x-4">
                            <button
                                type="button"
                                onClick={() => handleStatusChange('draft')}
                                className={`px-4 py-2 rounded-lg transition-colors ${formData.status === 'draft' ? 'bg-yellow-600' : 'bg-gray-600 hover:bg-gray-500'}`}
                            >
                                Draft
                            </button>
                            <button
                                type="button"
                                onClick={() => handleStatusChange('completed')}
                                className={`px-4 py-2 rounded-lg transition-colors ${formData.status === 'completed' ? 'bg-green-600' : 'bg-gray-600 hover:bg-gray-500'}`}
                            >
                                Complete
                            </button>
                            <button
                                type="button"
                                onClick={() => handleStatusChange('billed')}
                                className={`px-4 py-2 rounded-lg transition-colors ${formData.status === 'billed' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}
                            >
                                Billed
                            </button>
                        </div>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                        >
                            Save Invoice
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default InvoiceCreate; 