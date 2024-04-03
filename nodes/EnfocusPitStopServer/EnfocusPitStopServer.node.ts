/* eslint-disable n8n-nodes-base/node-class-description-icon-not-svg */
import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import {
	PitStopServer,
	PitStopServerOptions,
	VSOption,
	VariableSetOptions,
} from '@enfocussw/pitstop-server-cli';
import * as tmp from 'tmp-promise';
import * as fs from 'fs-extra';
import * as path from 'path';
import { variableOptions } from './VariableOptions';

export class EnfocusPitStopServer implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Enfocus PitStop Server',
		name: 'enfocusPitStopServer',
		group: ['transform'],
		icon: 'file:enfocuspitstopserver.png',
		version: 1,
		description: 'Enfocus PitStop Server node',
		defaults: {
			name: 'Enfocus PitStop Server',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				noDataExpression: true,
				type: 'options',
				options: [
					{
						name: 'Run',
						value: 'run',
						description:
							'This operation creates a configuration file that defines all the settings for PitStop Server and launches it',
						// eslint-disable-next-line n8n-nodes-base/node-param-operation-option-action-miscased
						action: 'Run PitStop Server',
					},
					{
						name: 'Cleanup',
						value: 'cleanup',
						description: 'This operation removes the output folder and all its contents',
						// eslint-disable-next-line n8n-nodes-base/node-param-operation-option-action-miscased
						action: 'Cleanup PitStop Server output folder',
					},
				],
				required: true,
				default: 'run',
			},
			{
				displayName: 'Input PDF Binary Field',
				name: 'inputPdfBinaryField',
				type: 'string',
				default: 'data',
				placeholder: 'data',
				description: 'The binary field to be used as the Input PDF',
				displayOptions: {
					show: {
						operation: ['run'],
					},
				},
			},
			{
				displayName: 'Output PDF Name',
				name: 'outputPdfName',
				type: 'string',
				default: 'output.pdf',
				placeholder: 'output.pdf',
				description: 'The name of the output PDF PitStop will create',
				displayOptions: {
					show: {
						operation: ['run'],
					},
				},
			},
			{
				displayName: 'Preflight Profile',
				name: 'preflightProfile',
				type: 'string',
				default: '',
				placeholder: '',
				description: 'The path to the Preflight Profile',
				displayOptions: {
					show: {
						operation: ['run'],
					},
				},
			},
			{
				displayName: 'Action Lists',
				name: 'actionLists',
				type: 'string',
				default: '[]',
				placeholder: '',
				description: 'An array of paths to the Action Lists',
				displayOptions: {
					show: {
						operation: ['run'],
					},
				},
			},
			{
				displayName: 'Variable Set',
				name: 'variableSet',
				type: 'options',
				description: 'Whether to use a Variable Set',
				noDataExpression: true,
				options: [
					{
						name: 'None',
						value: 'none',
					},
					{
						name: 'Create Variable Set',
						value: 'createvariableset',
					},
					{
						name: 'Update Variable Set',
						value: 'updatevariableset',
					},
				],
				default: 'none',
				displayOptions: {
					show: {
						operation: ['run'],
					},
				},
			},
			{
				displayName: 'Variable Set Path',
				name: 'variableSetPath',
				type: 'string',
				default: '',
				placeholder: '',
				description: 'The path to a template Variable Set',
				displayOptions: {
					show: {
						operation: ['run'],
						variableSet: ['updatevariableset'],
					},
				},
			},
			{
				displayName: 'Variables',
				name: 'variables',
				placeholder: 'Add Variable',
				description: 'Add a variable',
				type: 'fixedCollection',
				default: {},
				typeOptions: {
					multipleValues: true,
				},
				options: variableOptions,
				displayOptions: {
					show: {
						operation: ['run'],
						variableSet: ['createvariableset', 'updatevariableset'],
					},
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Generate Task Report',
						name: 'generateTaskReport',
						type: 'boolean',
						default: false,
						description: 'Whether to generate an XML task report',
					},
					{
						displayName: 'Generate XML Report',
						name: 'generateXmlReport',
						type: 'boolean',
						default: false,
						description: 'Whether to generate an XML report',
					},
					{
						displayName: 'Put Output File in Field',
						name: 'dataOutputPropertyName',
						type: 'string',
						default: 'outputData',
						placeholder: 'e.g. outputData',
						description: "By default 'outputData' is used",
					},
				],
				displayOptions: {
					show: {
						operation: ['run'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		let item: INodeExecutionData;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				item = items[itemIndex];

				const operation: string = this.getNodeParameter('operation', 0) as string;

				if (operation == 'run') {
					const inputPdfBinaryField = this.getNodeParameter(
						'inputPdfBinaryField',
						itemIndex,
						'',
					) as string;

					const binaryBuffer = await this.helpers.getBinaryDataBuffer(
						itemIndex,
						inputPdfBinaryField,
					);

					if (binaryBuffer == null) {
						throw new NodeOperationError(
							this.getNode(),
							'Unable to get Input PDF file binary buffer',
							{
								itemIndex,
							},
						);
					}

					const outputPdfName = this.getNodeParameter('outputPdfName', itemIndex, '') as string;

					const preflightProfile = this.getNodeParameter(
						'preflightProfile',
						itemIndex,
						'',
					) as string;
					const actionListsString = this.getNodeParameter('actionLists', itemIndex, '') as string;
					const actionLists: string[] = JSON.parse(actionListsString);

					const options = this.getNodeParameter('options', 0, {});

					const generateTaskReport: boolean = options.generateTaskReport as boolean;
					const generateXmlReport: boolean = options.generateXmlReport as boolean;

					const tmpDir: tmp.DirectoryResult = await tmp.dir({ prefix: 'enfocusPitStopServer' });

					const inputFile: tmp.FileResult = await tmp.file({
						prefix: 'enfocusPitStopServer',
						postfix: '.pdf',
					});
					await fs.writeFile(inputFile.path, binaryBuffer);

					let psOptions: PitStopServerOptions = {
						inputPDF: inputFile.path,
						outputFolder: tmpDir.path,
						outputPDFName: outputPdfName,
						taskReport: generateTaskReport,
						xmlReport: generateXmlReport,
					};

					if (actionLists.length > 0) {
						psOptions.actionLists = actionLists;
					}

					if (preflightProfile !== '') {
						psOptions.preflightProfile = preflightProfile;
					}

					const variableSet: string = this.getNodeParameter('variableSet', itemIndex) as string;

					if (variableSet === 'updatevariableset') {
						const variableSetPath = this.getNodeParameter(
							'variableSetPath',
							itemIndex,
							'',
						) as string;

						psOptions.variableSet = variableSetPath;
					}

					let ps: PitStopServer = new PitStopServer(psOptions);

					if (variableSet !== 'none') {
						const variables = (this.getNodeParameter('variables', itemIndex) as IDataObject)
							.variableOptions as IDataObject[];

						let variableSetOptions: VariableSetOptions = [];

						if (variables !== undefined) {
							for (const variable of variables) {
								variableSetOptions.push({
									variable: variable.variableName,
									type: variable.variableType,
									value: variable.variableValue,
								} as VSOption);
							}
						}

						ps.createVariableSet(variableSetOptions);
					}

					let result = await ps.run();

					if (result.exitCode !== 0) {
						throw new NodeOperationError(this.getNode(), result.stderr, {
							itemIndex,
						});
					}

					let psInstances: any[] = [];

					if (item.json['pitStopServerInstances'] !== undefined) {
						psInstances = item.json['pitStopServerInstances'] as any[];
					}

					psInstances.push(ps);
					item.json['pitStopServerInstances'] = psInstances;

					if (options.dataOutputPropertyName) {
						let dataOutputPropertyName: string = 'outputData';
						dataOutputPropertyName = options.dataOutputPropertyName as string;

						const dataOutputFilePath: string = path.join(tmpDir.path, outputPdfName);

						const stream = await fs.readFile(dataOutputFilePath);
						item.binary![dataOutputPropertyName] = await this.helpers.prepareBinaryData(
							stream,
							dataOutputFilePath,
						);
					}

					await inputFile.cleanup();
				}

				if (operation === 'cleanup') {
					const psInstances: IDataObject[] = item.json['pitStopServerInstances'] as IDataObject[];

					if (psInstances === undefined) {
						throw new NodeOperationError(
							this.getNode(),
							'pitStopServerInstances undefined, unable to cleanup PitStop Server output folder',
							{
								itemIndex,
							},
						);
					}

					for (const instance of psInstances) {
						let psOptions: PitStopServerOptions = {
							inputPDF: instance['inputPDF'] as string,
							outputFolder: instance['outputFolder'] as string,
							outputPDFName: instance['outputPDFName'] as string,
							actionLists: instance['actionLists'] as string[],
							preflightProfile: instance['preflightProfile'] as string,
						};

						let ps: PitStopServer = new PitStopServer(psOptions);
						ps.cleanup();
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					items.push({ json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex });
				} else {
					if (error.context) {
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		return this.prepareOutputData(items);
	}
}
