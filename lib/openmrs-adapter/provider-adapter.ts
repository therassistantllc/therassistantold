export type TherAssistantStaffProfile = {
	id: string;
	organizationId: string;
	firstName?: string | null;
	lastName?: string | null;
	email?: string | null;
	phone?: string | null;
	providerNpi?: string | null;
	staffStatus?: string | null;
	roleNames?: string[];
	permissions?: string[];
};

export type CreateOpenMrsProviderInput = {
	staff: TherAssistantStaffProfile;
};

export type SyncOpenMrsProviderRolesInput = {
	staffId: string;
	roleNames: string[];
	permissions: string[];
};

export function mapStaffToOpenMrsUserPayload(input: TherAssistantStaffProfile) {
	return {
		username: input.email ?? input.id,
		person: {
			names: [
				{
					givenName: input.firstName ?? "",
					familyName: input.lastName ?? "",
				},
			],
		},
		systemId: input.id,
	};
}

export function mapStaffToOpenMrsProviderPayload(input: TherAssistantStaffProfile) {
	return {
		identifier: input.providerNpi ?? input.id,
		person: undefined,
		attributes: [],
	};
}

export async function createOrUpdateOpenMrsProvider(_input: CreateOpenMrsProviderInput) {
	// later:
	// 1. create/find OpenMRS User
	// 2. create/find OpenMRS Provider
	// 3. attach provider identifier/NPI
	return null;
}

export async function syncOpenMrsProviderRoles(_input: SyncOpenMrsProviderRolesInput) {
	// later:
	// map TherAssistant roles/permissions to OpenMRS Role + Privilege
	return null;
}
