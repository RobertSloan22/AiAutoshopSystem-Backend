import React, { createContext, useContext, useState } from 'react';
var CustomerContext = createContext(undefined);
export var CustomerProvider = function (_a) {
    var children = _a.children;
    var _b = useState(null), selectedCustomer = _b[0], setSelectedCustomer = _b[1];
    var _c = useState(null), selectedVehicle = _c[0], setSelectedVehicle = _c[1];
    return (<CustomerContext.Provider value={{
            selectedCustomer: selectedCustomer,
            selectedVehicle: selectedVehicle,
            setSelectedCustomer: setSelectedCustomer,
            setSelectedVehicle: setSelectedVehicle
        }}>
            {children}
        </CustomerContext.Provider>);
};
export var useCustomer = function () {
    var context = useContext(CustomerContext);
    if (context === undefined) {
        throw new Error('useCustomer must be used within a CustomerProvider');
    }
    return context;
};
