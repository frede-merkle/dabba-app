import fs from 'fs';
import {createClient} from '@supabase/supabase-js';
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_PUBLIC_URL;
const supabaseAPIKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(`${supabaseUrl}`, `${supabaseAPIKey}`);

export async function createUser(name, dabbaName, company) {
    let userModel = {name: name, dabba_name: dabbaName, company: company};
    const {error} = await supabase
        .from('users')
        .insert(userModel);

    if (error) {
        return error;
    }
    return null;
}

async function uploadUsersFromFile(filePath) {
    try {
        const rawData = fs.readFileSync(filePath, 'utf-8');
        const employees = JSON.parse(rawData);
        for (const employee of employees) {
            const error = await createUser(employee.name, employee.dabba_name, employee.company);
            if (error) {
                console.error(`Failed to upload employee:`, error);
            } else {
                console.log(`Successfully uploaded employee:`, employee);
            }
        }

        console.log("Finished uploading all users.");
    } catch (error) {
        console.error("Error uploading users:", error.message);
    }
}

const filePath = './users.json';
uploadUsersFromFile(filePath);