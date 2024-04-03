import { INodeProperties, INodePropertyCollection, INodePropertyOptions } from 'n8n-workflow';

export const variableOptions: (INodeProperties | INodePropertyOptions | INodePropertyCollection)[] =
	[
		{
			displayName: 'Variables',
			name: 'variableOptions',
			values: [
				{
					displayName: 'Variable',
					name: 'variableName',
					type: 'string',
					default: 'Name of the variable key to add',
				},
				{
					displayName: 'Type',
					name: 'variableType',
					type: 'options',
					noDataExpression: true,
					options: [
						{
							name: 'String',
							value: 'String',
						},
						{
							name: 'Number',
							value: 'Number',
						},
						{
							name: 'Length',
							value: 'Length',
						},
						{
							name: 'Boolean',
							value: 'Boolean',
						},
					],
					default: 'String',
				},
				{
					displayName: 'Value',
					name: 'variableValue',
					type: 'string',
					default: '',
					description: 'Value to set for the variable key',
				},
			],
		},
	];
