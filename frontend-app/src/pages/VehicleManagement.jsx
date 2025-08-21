import React, { useState } from 'react'
import { Plus, Car, Edit, Trash2, Search } from 'lucide-react'
import { useQuery } from 'react-query'
import { vehicleAPI } from '../services/api'
import { useAppContext } from '../context/AppContext'

export function VehicleManagement() {
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState(null)
  const { setCurrentVehicle, showError, showSuccess } = useAppContext()

  const { data: vehicles, isLoading, refetch } = useQuery(
    'vehicles',
    () => vehicleAPI.list({ limit: 100 })
  )

  const filteredVehicles = vehicles?.filter(vehicle => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      vehicle.year?.toString().includes(query) ||
      vehicle.make?.toLowerCase().includes(query) ||
      vehicle.model?.toLowerCase().includes(query) ||
      vehicle.vin?.toLowerCase().includes(query) ||
      vehicle.licensePlate?.toLowerCase().includes(query)
    )
  }) || []

  const handleDelete = async (vehicle) => {
    if (window.confirm(`Delete ${vehicle.year} ${vehicle.make} ${vehicle.model}?`)) {
      try {
        await vehicleAPI.delete(vehicle.id)
        showSuccess('Vehicle deleted successfully')
        refetch()
      } catch (error) {
        showError(error.message || 'Failed to delete vehicle')
      }
    }
  }

  const handleEdit = (vehicle) => {
    setEditingVehicle(vehicle)
    setShowAddForm(true)
  }

  const handleSetCurrent = (vehicle) => {
    setCurrentVehicle(vehicle)
    showSuccess(`Selected ${vehicle.year} ${vehicle.make} ${vehicle.model}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Vehicle Management
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your vehicle database
          </p>
        </div>
        
        <button
          onClick={() => {
            setEditingVehicle(null)
            setShowAddForm(true)
          }}
          className="btn btn-automotive"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Vehicle
        </button>
      </div>

      {/* Search */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search vehicles by year, make, model, VIN, or license plate..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
              />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Vehicle List */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Vehicles ({filteredVehicles.length})
            </h3>
          </div>
        </div>
        
        <div className="card-body p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-automotive-600"></div>
              <span className="ml-2 text-gray-500">Loading vehicles...</span>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="text-center py-12">
              <Car className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {searchQuery ? 'No vehicles found' : 'No vehicles yet'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {searchQuery 
                  ? 'Try adjusting your search criteria'
                  : 'Add your first vehicle to get started'
                }
              </p>
              {!searchQuery && (
                <button
                  onClick={() => {
                    setEditingVehicle(null)
                    setShowAddForm(true)
                  }}
                  className="btn btn-automotive"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Vehicle
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredVehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  onEdit={() => handleEdit(vehicle)}
                  onDelete={() => handleDelete(vehicle)}
                  onSetCurrent={() => handleSetCurrent(vehicle)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Vehicle Modal */}
      {showAddForm && (
        <VehicleForm
          vehicle={editingVehicle}
          onClose={() => {
            setShowAddForm(false)
            setEditingVehicle(null)
          }}
          onSave={() => {
            setShowAddForm(false)
            setEditingVehicle(null)
            refetch()
          }}
        />
      )}
    </div>
  )
}

function VehicleCard({ vehicle, onEdit, onDelete, onSetCurrent }) {
  const { currentVehicle } = useAppContext()
  const isSelected = currentVehicle?.id === vehicle.id

  return (
    <div className={`
      p-6 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
      ${isSelected ? 'bg-automotive-50 dark:bg-automotive-900 border-l-4 border-automotive-500' : ''}
    `}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className={`
            p-3 rounded-full
            ${isSelected ? 'bg-automotive-500' : 'bg-gray-200 dark:bg-gray-700'}
          `}>
            <Car className={`h-6 w-6 ${isSelected ? 'text-white' : 'text-gray-500'}`} />
          </div>
          
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h3>
              {isSelected && (
                <span className="bg-automotive-100 text-automotive-800 text-xs px-2 py-1 rounded-full">
                  Current
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
              {vehicle.vin && (
                <div>
                  <span className="font-medium">VIN:</span> {vehicle.vin}
                </div>
              )}
              {vehicle.licensePlate && (
                <div>
                  <span className="font-medium">License:</span> {vehicle.licensePlate}
                </div>
              )}
              {vehicle.color && (
                <div>
                  <span className="font-medium">Color:</span> {vehicle.color}
                </div>
              )}
              {vehicle.engineSize && (
                <div>
                  <span className="font-medium">Engine:</span> {vehicle.engineSize}
                </div>
              )}
              {vehicle.fuelType && (
                <div>
                  <span className="font-medium">Fuel:</span> {vehicle.fuelType}
                </div>
              )}
              {vehicle.mileage && (
                <div>
                  <span className="font-medium">Mileage:</span> {vehicle.mileage.toLocaleString()} mi
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {!isSelected && (
            <button
              onClick={onSetCurrent}
              className="btn btn-secondary btn-sm"
            >
              Select
            </button>
          )}
          
          <button
            onClick={onEdit}
            className="btn btn-secondary btn-sm"
            title="Edit vehicle"
          >
            <Edit className="h-4 w-4" />
          </button>
          
          <button
            onClick={onDelete}
            className="btn btn-danger btn-sm"
            title="Delete vehicle"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function VehicleForm({ vehicle, onClose, onSave }) {
  const [formData, setFormData] = useState({
    year: vehicle?.year || '',
    make: vehicle?.make || '',
    model: vehicle?.model || '',
    vin: vehicle?.vin || '',
    licensePlate: vehicle?.licensePlate || '',
    color: vehicle?.color || '',
    engineSize: vehicle?.engineSize || '',
    fuelType: vehicle?.fuelType || '',
    mileage: vehicle?.mileage || '',
    notes: vehicle?.notes || ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { showError, showSuccess } = useAppContext()

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 50 }, (_, i) => currentYear - i)
  
  const commonMakes = [
    'Acura', 'Audi', 'BMW', 'Cadillac', 'Chevrolet', 'Chrysler', 'Dodge',
    'Ford', 'GMC', 'Honda', 'Hyundai', 'Infiniti', 'Jaguar', 'Jeep',
    'Kia', 'Land Rover', 'Lexus', 'Lincoln', 'Mazda', 'Mercedes-Benz',
    'Nissan', 'Porsche', 'RAM', 'Subaru', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo'
  ]

  const fuelTypes = ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Plug-in Hybrid', 'Ethanol', 'CNG']

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const submitData = {
        ...formData,
        year: parseInt(formData.year),
        mileage: formData.mileage ? parseInt(formData.mileage) : null
      }

      if (vehicle) {
        await vehicleAPI.update(vehicle.id, submitData)
        showSuccess('Vehicle updated successfully')
      } else {
        await vehicleAPI.create(submitData)
        showSuccess('Vehicle added successfully')
      }
      
      onSave()
    } catch (error) {
      showError(error.message || 'Failed to save vehicle')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            {vehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                </select>
              </div>

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
            </div>

            {/* Identification */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  VIN
                </label>
                <input
                  type="text"
                  value={formData.vin}
                  onChange={(e) => handleChange('vin', e.target.value.toUpperCase())}
                  className="input"
                  placeholder="17-digit VIN"
                  maxLength={17}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  License Plate
                </label>
                <input
                  type="text"
                  value={formData.licensePlate}
                  onChange={(e) => handleChange('licensePlate', e.target.value.toUpperCase())}
                  className="input"
                  placeholder="License plate number"
                />
              </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Color
                </label>
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => handleChange('color', e.target.value)}
                  className="input"
                  placeholder="Vehicle color"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Engine Size
                </label>
                <input
                  type="text"
                  value={formData.engineSize}
                  onChange={(e) => handleChange('engineSize', e.target.value)}
                  className="input"
                  placeholder="2.0L, V6, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Fuel Type
                </label>
                <select
                  value={formData.fuelType}
                  onChange={(e) => handleChange('fuelType', e.target.value)}
                  className="input"
                >
                  <option value="">Select fuel type</option>
                  {fuelTypes.map(fuel => (
                    <option key={fuel} value={fuel}>{fuel}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Mileage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Current Mileage
              </label>
              <input
                type="number"
                value={formData.mileage}
                onChange={(e) => handleChange('mileage', e.target.value)}
                className="input"
                placeholder="Current odometer reading"
                min="0"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={3}
                className="input"
                placeholder="Additional notes about this vehicle..."
              />
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
                {isSubmitting 
                  ? (vehicle ? 'Updating...' : 'Adding...')
                  : (vehicle ? 'Update Vehicle' : 'Add Vehicle')
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}