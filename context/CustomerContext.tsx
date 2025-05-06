import React, { createContext, useContext, useState } from 'react';

interface Vehicle {
    year: number;
    make: string;
    model: string;
    vin?: string;
    mileage?: number;
}

interface Customer {
    firstName: string;
    lastName: string;
    location?: string;
}

interface CustomerContextType {
    selectedCustomer: Customer | null;
    selectedVehicle: Vehicle | null;
    setSelectedCustomer: (customer: Customer | null) => void;
    setSelectedVehicle: (vehicle: Vehicle | null) => void;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export const CustomerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

    return (
        <CustomerContext.Provider value={{
            selectedCustomer,
            selectedVehicle,
            setSelectedCustomer,
            setSelectedVehicle
        }}>
            {children}
        </CustomerContext.Provider>
    );
};

export const useCustomer = () => {
    const context = useContext(CustomerContext);
    if (context === undefined) {
        throw new Error('useCustomer must be used within a CustomerProvider');
    }
    return context;
}; 