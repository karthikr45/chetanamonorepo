import { API_ENDPOINTS } from "@/services/constants/endpoints";
import { get, post } from "@/lib/api-client";
export async function getNotificationApi(role:string,branch:string){
    const url = `${API_ENDPOINTS.studentsDetails.getAdminNotifications}`;
    return post<void>(url, { role,branch });
    // const url

}