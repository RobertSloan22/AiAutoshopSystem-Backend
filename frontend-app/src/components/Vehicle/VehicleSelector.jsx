import React, { useState } from 'react'
import { ChevronDown, Car, Plus, Check } from 'lucide-react'
import { useQuery } from 'react-query'
import { vehicleAPI } from '../../services/api'
import { useAppContext } from '../../context/AppContext'

export function VehicleSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const { currentVehicle, setCurrentVehicle } = useAppContext()

  const { data: vehicles, isLoading, refetch } = useQuery(
    'vehicles',
    () => vehicleAPI.list({ limit: 20, sortBy: 'recent' })
  )

  const handleVehicleSelect = (vehicle) => {
    setCurrentVehicle(vehicle)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      {/* Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-automotive-500 transition-colors"
      >
        <Car className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {currentVehicle 
            ? `${currentVehicle.year} ${currentVehicle.make} ${currentVehicle.model}`
            : 'Select Vehicle'
          }
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-20">
          {/* Header */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                Select Vehicle
              </h3>
              <button
                onClick={() => setShowAddForm(true)}
                className="text-automotive-600 hover:text-automotive-700 dark:text-automotive-400 dark:hover:text-automotive-300"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Vehicle List */}
          <div className="max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-automotive-600 mx-auto"></div>
              </div>
            ) : vehicles && vehicles.length > 0 ? (
              <>
                {/* No Vehicle Option */}
                <button
                  onClick={() => handleVehicleSelect(null)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-between"
                >
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    No vehicle selected
                  </span>
                  {!currentVehicle && <Check className="h-4 w-4 text-automotive-600" />}
                </button>

                {/* Vehicles */}
                {vehicles.map((vehicle) => (
                  <button
                    key={vehicle.id}
                    onClick={() => handleVehicleSelect(vehicle)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </p>
                      {vehicle.vin && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          VIN: {vehicle.vin.slice(-6)}
                        </p>
                      )}
                    </div>
                    {currentVehicle?.id === vehicle.id && (
                      <Check className="h-4 w-4 text-automotive-600" />
                    )}
                  </button>
                ))}
              </>
            ) : (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No vehicles found</p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="text-automotive-600 hover:text-automotive-700 dark:text-automotive-400 dark:hover:text-automotive-300 text-sm mt-1"
                >
                  Add your first vehicle
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Vehicle Form Modal */}
      {showAddForm && (
        <AddVehicleForm
          onClose={() => setShowAddForm(false)}
          onSave={(vehicle) => {
            setCurrentVehicle(vehicle)
            setShowAddForm(false)
            setIsOpen(false)
            refetch()
          }}
        />
      )}

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

function AddVehicleForm({ onClose, onSave }) {
  const [formData, setFormData] = useState({
    year: '',
    make: '',
    model: '',
    vin: '',
    licensePlate: '',
    color: '',
    engineSize: '',
    fuelType: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { showError, showSuccess } = useAppContext()

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 30 }, (_, i) => currentYear - i)

  const commonMakes = [
    'Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan', 'BMW', 'Mercedes-Benz',
    'Volkswagen', 'Audi', 'Hyundai', 'Kia', 'Subaru', 'Mazda', 'Lexus',
    'Infiniti', 'Acura', 'Jeep', 'RAM', 'GMC', 'Cadillac', 'Lincoln',
    'Volvo', 'Jaguar', 'Land Rover', 'Porsche', 'Tesla'
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const vehicle = await vehicleAPI.create({
        ...formData,
        year: parseInt(formData.year),
      })
      showSuccess('Vehicle added successfully')
      onSave(vehicle)
    } catch (error) {
      showError(error.message || 'Failed to add vehicle')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Add Vehicle
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Year */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Year *
            </label>
            <select
              required
              value={formData.year}
              onChange={(e) => handleChange('year', e.target.value)}
              className="input"
            >
              <option value="">Select Year</option>
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* Make */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Make *
            </label>
            <select
              required
              value={formData.make}
              onChange={(e) => handleChange('make', e.target.value)}
              className="input"
            >
              <option value="">Select Make</option>
              {commonMakes.map(make => (
                <option key={make} value={make}>{make}</option>
              ))}
              <option value="other">Other</option>
            </select>
            {formData.make === 'other' && (
              <input
                type="text"
                placeholder="Enter make"
                value={formData.customMake || ''}
                onChange={(e) => handleChange('customMake', e.target.value)}
                className="input mt-2"
                required
              />
            )}
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Model *
            </label>
            <input
              type="text"
              required
              value={formData.model}
              onChange={(e) => handleChange('model', e.target.value)}
              className="input"
              placeholder="Enter model"
            />
          </div>

          {/* VIN */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              VIN
            </label>
            <input
              type="text"
              value={formData.vin}
              onChange={(e) => handleChange('vin', e.target.value.toUpperCase())}
              className="input"
              placeholder="Enter 17-digit VIN"
              maxLength={17}
            />
          </div>

          {/* License Plate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              License Plate
            </label>
            <input
              type="text"
              value={formData.licensePlate}
              onChange={(e) => handleChange('licensePlate', e.target.value.toUpperCase())}
              className="input"
              placeholder="Enter license plate"
            />
          </div>

          {/* Additional Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Color
              </label>
              <input
                type="text"
                value={formData.color}
                onChange={(e) => handleChange('color', e.target.value)}
                className="input"
                placeholder="Color"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Engine
              </label>
              <input
                type="text"
                value={formData.engineSize}
                onChange={(e) => handleChange('engineSize', e.target.value)}
                className="input"
                placeholder="2.0L, V6, etc."
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-automotive"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Adding...' : 'Add Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}