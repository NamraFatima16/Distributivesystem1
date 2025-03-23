import { Construct } from 'constructs';
import { books } from '../seed/books';
import { generateBatch } from '../shared/util';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as custom from "aws-cdk-lib/custom-resources";
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
export class DistributiveSystemAssignment1Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    // Create table for books 
    const booksTable = new dynamodb.Table(this, 'BooksTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'Genre', type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'ISBN', type: dynamodb.AttributeType.STRING
      },
      tableName: 'BooksTable',
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // custom resource for seeding the books table
    new custom.AwsCustomResource(this, 'booksSeedData', {
      onCreate: {
        service: 'DynamoDB',
        action: 'BatchWriteItem',
        parameters: {
          RequestItems: {
            [booksTable.tableName]: generateBatch(books)
          }
        },
        physicalResourceId: custom.PhysicalResourceId.of('bookSeedData')
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [booksTable.tableArn]
      })
    });

    //Lambda function integration

    const getBooksByGenreFn = new lambda.NodejsFunction(this, 'GetBooksByGenreLambda', {
      entry: path.join(__dirname, '../lambdas/getBooksByGenre.ts'),
      handler: 'handler',
      environment: {
        TABLE_NAME: booksTable.tableName
      }
    })

    const addBooksFn = new lambda.NodejsFunction(this, 'AddBooks', {
      entry: path.join(__dirname, '../lambdas/addBook.ts'),
      handler: 'handler',
      environment: {
        TABLE_NAME: booksTable.tableName
      }
    })

    const updateBooksFn = new lambda.NodejsFunction(this, 'UpdateBooks', {
      entry: path.join(__dirname, '../lambdas/updateBook.ts'),
      handler: 'handler',
      environment: {
        TABLE_NAME: booksTable.tableName
      }
    })
    const translateBookFn = new lambda.NodejsFunction(this, 'TranslateBook', {
      entry: path.join(__dirname, '../lambdas/translateBook.ts'),
      handler: 'handler',
      environment: {
        TABLE_NAME: booksTable.tableName,
        REGION: this.region
      }
    });

    // Permissions for lambda functions
    booksTable.grantReadData(getBooksByGenreFn)
    booksTable.grantReadWriteData(addBooksFn)
    booksTable.grantReadWriteData(updateBooksFn)
    booksTable.grantReadWriteData(translateBookFn);
    translateBookFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['translate:TranslateText'],
      resources: ['*'],
    }));

    //Api gateway implementation
    const apiGW = new apigateway.RestApi(this, 'BooksApi', {
      restApiName: "BooksAppApi",
      deployOptions: {
        stageName: "dev",
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true
      },
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date"],
        allowMethods: ["GET", "POST", "PUT"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
      apiKeySourceType: apigateway.ApiKeySourceType.HEADER
    });

    const bookApiKey = new apigateway.ApiKey(this, "addBookApiKey", {
      description: 'Api key for POST and PUT methods to write and update books in DB',
      enabled: true
    })

    const usagePlan = new apigateway.UsagePlan(this, 'BookApiUsagePlan', {
      name: 'apiUsagePlan',
      description: 'Usage plan for the book API',
      throttle: {
        rateLimit: 1000,
        burstLimit: 200,
      },
      apiStages: [
        {
          api: apiGW,
          stage: apiGW.deploymentStage
        }
      ]
    });

    usagePlan.addApiKey(bookApiKey)

    const bookCreateModel: apigateway.Model = apiGW.addModel('BookCreateModel', {
      description: "Schema for Book Table for creating new Books",
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          Genre: { type: apigateway.JsonSchemaType.STRING },
          ISBN: { type: apigateway.JsonSchemaType.STRING },
          Title: { type: apigateway.JsonSchemaType.STRING },
          Author: { type: apigateway.JsonSchemaType.STRING },
          PublicationYear: { type: apigateway.JsonSchemaType.NUMBER },
          Description: { type: apigateway.JsonSchemaType.STRING }
        },
        required: ['Genre', 'ISBN', 'Description']
      }
    });

    const bookUpdateModel: apigateway.Model = apiGW.addModel('BookUpdateModel', {
      description: "Schema for Book Table for updating a book",
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          Title: { type: apigateway.JsonSchemaType.STRING },
          Author: { type: apigateway.JsonSchemaType.STRING },
          PublicationYear: { type: apigateway.JsonSchemaType.NUMBER },
          Description: { type: apigateway.JsonSchemaType.STRING }
        },
      }
    });

    const booksEndpoint = apiGW.root.addResource("books");
    const genreEndpoint = booksEndpoint.addResource("{genre}");
    const isbnEndpoint = genreEndpoint.addResource("{ISBN}");

    booksEndpoint.addMethod(
      "POST",
      new apigateway.LambdaIntegration(addBooksFn, { proxy: true }), {
      "apiKeyRequired": true,
      requestModels: {
        "application/json": bookCreateModel,
      },
      requestValidatorOptions: {
        validateRequestBody: true
      }
    }
    );

    genreEndpoint.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getBooksByGenreFn, { proxy: true })
    );

    isbnEndpoint.addMethod(
      "PUT",
      new apigateway.LambdaIntegration(updateBooksFn, { proxy: true }), {
      "apiKeyRequired": true,
      requestModels: {
        "application/json": bookUpdateModel,
      },
      requestValidatorOptions: {
        validateRequestBody: true
      }
    }
    );
    // translation endpoint and connected to lambda
    const translationEndpoint = isbnEndpoint.addResource("translation");

    translationEndpoint.addMethod(
      "GET",
      new apigateway.LambdaIntegration(translateBookFn, { proxy: true }),
      {
        requestParameters: {
          'method.request.querystring.language': true,
        }
      }
    );

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: apiGW.url,
      description: 'URL of the API Gateway',
    });
  }
}
