// src/components/VehicleResearch.jsx
import React, { useState } from 'react';
import { useCustomer } from '../../context/CustomerContext';
import { useVehicle } from '../../context/VehicleContext';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';

const VehicleDetailsModal = ({ vehicle, onClose }) => {
    if (!vehicle) return null;

    const renderField = (label, value) => {
        if (value === undefined || value === null || value === '') return null;
        return (
            <div className="mb-3">
                <span className="text-blue-400 text-xl">{label}:</span>
                <span className="text-white text-xl ml-2">
                    {typeof value === 'boolean' 
                        ? (value ? 'Yes' : 'No') 
                        : typeof value === 'number' 
                            ? value.toLocaleString()
                            : value}
                </span>
            </div>
        );
    };

    const renderStatusBadge = (status) => {
        const statusClasses = {
            'active': 'bg-green-500 text-white',
            'in-service': 'bg-yellow-500 text-black',
            'inactive': 'bg-red-500 text-white'
        };

        return (
            <span className={`px-3 py-1 rounded-full text-sm ${statusClasses[status] || 'bg-gray-500 text-white'}`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-4 bg-gray-800 bg-opacity-50 rounded-t-lg border-l-4 border-blue-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-4 mb-2">
                                <h2 className="text-2xl font-bold text-white">
                                    {vehicle.year} {vehicle.make} {vehicle.model}
                                    {vehicle.trim && ` ${vehicle.trim}`}
                                </h2>
                                {vehicle.status && renderStatusBadge(vehicle.status)}
                            </div>
                            <p className="text-white text-xl">
                                <span className="text-blue-400">VIN:</span> {vehicle.vin || 'Not Specified'}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors p-2"
                            aria-label="Close modal"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Vehicle Information */}
                        <div className="space-y-6">
                            {/* Basic Information */}
                            <div className="p-4 bg-gray-800 bg-opacity-50 rounded-lg border-l-4 border-blue-500">
                                <h3 className="text-xl font-semibold text-blue-400 mb-4 border-b border-gray-700 pb-2">
                                    Basic Information
                                </h3>
                                {renderField('Year', vehicle.year)}
                                {renderField('Make', vehicle.make)}
                                {renderField('Model', vehicle.model)}
                                {renderField('Trim', vehicle.trim)}
                                {renderField('Color', vehicle.color)}
                                {renderField('License Plate', vehicle.licensePlate)}
                                {renderField('Mileage', vehicle.mileage && `${vehicle.mileage.toLocaleString()} miles`)}
                            </div>

                            {/* Technical Specifications */}
                            <div className="p-4 bg-gray-800 bg-opacity-50 rounded-lg border-l-4 border-blue-500">
                                <h3 className="text-xl font-semibold text-blue-400 mb-4 border-b border-gray-700 pb-2">
                                    Technical Specifications
                                </h3>
                                {renderField('Engine', vehicle.engine)}
                                {renderField('Engine Size', vehicle.engineSize && `${vehicle.engineSize}L`)}
                                {renderField('Transmission', vehicle.transmission)}
                                {renderField('Fuel Type', vehicle.fuelType)}
                                {renderField('Turbocharged', vehicle.turbocharged)}
                                {renderField('AWD', vehicle.isAWD)}
                                {renderField('4x4', vehicle.is4x4)}
                            </div>
                        </div>

                        {/* Additional Information */}
                        <div className="space-y-6">
                            {/* Service Status */}
                            <div className="p-4 bg-gray-800 bg-opacity-50 rounded-lg border-l-4 border-blue-500">
                                <h3 className="text-xl font-semibold text-blue-400 mb-4 border-b border-gray-700 pb-2">
                                    Service Status
                                </h3>
                                {renderField('Current Status', vehicle.status)}
                                {renderField('Last Service Date', vehicle.lastServiceDate)}
                                {renderField('Next Service Due', vehicle.nextServiceDue)}
                            </div>

                            {/* Notes */}
                            {vehicle.notes && (
                                <div className="p-4 bg-gray-800 bg-opacity-50 rounded-lg border-l-4 border-blue-500">
                                    <h3 className="text-xl font-semibold text-blue-400 mb-4 border-b border-gray-700 pb-2">
                                        Notes
                                    </h3>
                                    <p className="text-white text-xl whitespace-pre-wrap">{vehicle.notes}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-700">
                        <Link
                            to={`/vehicles/${vehicle._id}`}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
                        >
                            View Full Details
                        </Link>
                        <button
                            onClick={onClose}
                            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

VehicleDetailsModal.propTypes = {
    vehicle: PropTypes.shape({
        _id: PropTypes.string.isRequired,
        year: PropTypes.number,
        make: PropTypes.string,
        model: PropTypes.string,
        trim: PropTypes.string,
        status: PropTypes.string,
        vin: PropTypes.string,
        licensePlate: PropTypes.string,
        color: PropTypes.string,
        mileage: PropTypes.number,
        engine: PropTypes.string,
        engineSize: PropTypes.number,
        transmission: PropTypes.string,
        fuelType: PropTypes.string,
        turbocharged: PropTypes.bool,
        isAWD: PropTypes.bool,
        is4x4: PropTypes.bool,
        notes: PropTypes.string,
        lastServiceDate: PropTypes.string,
        nextServiceDue: PropTypes.string
    }),
    onClose: PropTypes.func.isRequired
};

export default VehicleDetailsModal; 