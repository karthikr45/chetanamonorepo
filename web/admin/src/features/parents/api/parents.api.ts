/**
 * Parents feature — backend API calls. No business logic.
 */

import { del, get, patch, post } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/services/constants/endpoints";
import type {
  CreateParentInput,
  Parent,
  ParentStudentLink,
} from "../types";

export async function listParentsApi(): Promise<Parent[]> {
  return get<Parent[]>(API_ENDPOINTS.parents.list);
}

export async function getParentByIdApi(id: string): Promise<Parent> {
  return get<Parent>(`${API_ENDPOINTS.parents.detail}/${id}`);
}

export async function createParentApi(
  body: CreateParentInput,
): Promise<Parent> {
  return post<Parent, CreateParentInput>(API_ENDPOINTS.parents.create, body);
}

export async function updateParentApi(
  id: string,
  body: Partial<Omit<CreateParentInput, "students">>,
): Promise<Parent> {
  return patch<Parent>(`${API_ENDPOINTS.parents.update}/${id}`, body);
}

export async function deleteParentApi(id: string): Promise<void> {
  await del(`${API_ENDPOINTS.parents.remove}/${id}`);
}

export async function addStudentLinkApi(
  parentId: string,
  body: CreateParentInput["students"][number],
): Promise<ParentStudentLink> {
  return post<ParentStudentLink>(
    `${API_ENDPOINTS.parents.addStudent}/${parentId}/students`,
    body,
  );
}

export async function removeStudentLinkApi(
  parentId: string,
  linkId: string,
): Promise<void> {
  await del(
    `${API_ENDPOINTS.parents.removeStudent}/${parentId}/students/${linkId}`,
  );
}
