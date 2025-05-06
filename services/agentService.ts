import axiosInstance from '../utils/axiosConfig';
import { Customer, Vehicle } from '../types';

interface AgentService {
    sendComprehensiveData: (
        customer: Customer,
        vehicle: Vehicle,
        images: string[],
        researchData: any
    ) => Promise<void>;
}

class AgentServiceImpl implements AgentService {
    async sendComprehensiveData(
        customer: Customer,
        vehicle: Vehicle,
        images: string[],
        researchData: any
    ): Promise<void> {
        try {
            await axiosInstance.post('/agent/data', {
                customer,
                vehicle,
                images,
                researchData
            });
        } catch (error) {
            console.error('Error sending data to agent:', error);
            throw error;
        }
    }
}

export const agentService: AgentService = new AgentServiceImpl(); 