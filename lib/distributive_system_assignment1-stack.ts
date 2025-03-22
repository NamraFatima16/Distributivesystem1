import * as cdk from 'aws-cdk-lib';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { AwsCustomResource, PhysicalResourceId,AwsCustomResourcePolicy}from "aws-cdk-lib/custom-resources";
import * as path from 'path';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { books } from '../seed/books';
import { generateBatch } from '../shared/util';

export class DistributiveSystemAssignment1Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    const booksTable = new dynamodb.Table(this, 'BooksTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'Author', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'Genre#Title#ISBN', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: 'Books',
    });

    new AwsCustomResource(this,'booksSeedData',{
      onCreate: {service:'DynamoDB', action:'BatchWriteItem',
        parameters:{
          RequestItems:{
            [booksTable.tableName]: generateBatch(books)
          }
        },
        physicalResourceId: PhysicalResourceId.of('bookSeedData')
       },

       policy:AwsCustomResourcePolicy.fromSdkCalls({
        resources: [booksTable.tableArn],
     })

      

    })

    // const addBookLambda = new lambdanode.NodejsFunction(this, 'AddBookLambda', {
    //   entry: path.join(__dirname, '../lambdas/addBook.ts'),
    //   handler: 'handler',
    //   environment: { TABLE_NAME: booksTable.tableName },
    // });

    // const getBooksLambda = new lambdanode.NodejsFunction(this, 'GetBooksLambda', {
    //   entry: path.join(__dirname, '../lambdas/getBooks.ts'),
    //   handler: 'handler',
    //   environment: { TABLE_NAME: booksTable.tableName },
    // });

    // const updateBookLambda = new lambdanode.NodejsFunction(this, 'UpdateBookLambda', {
    //   entry: path.join(__dirname, '../lambdas/updateBook.ts'),
    //   handler: 'handler',
    //   environment: { TABLE_NAME: booksTable.tableName },
    // });

    // const translateBookLambda = new lambdanode.NodejsFunction(this, 'TranslateBookLambda', {
    //   entry: path.join(__dirname, '../lambdas/translateBook.ts'),
    //   handler: 'handler',
    //   environment: { TABLE_NAME: booksTable.tableName, REGION: this.region },
    // });

    // // granting permissions
    // booksTable.grantReadWriteData(addBookLambda);
    // booksTable.grantReadData(getBooksLambda);
    // booksTable.grantReadWriteData(updateBookLambda);
    // booksTable.grantReadWriteData(translateBookLambda);
    // translateBookLambda.addToRolePolicy(new iam.PolicyStatement({
    //   actions: ['translate:TranslateText'],
    //   resources: ['*'],
    // }));


    // //api gateway implementation 
    // const api = new apigateway.RestApi(this, 'BooksApi');
    // const booksResource = api.root.addResource('books');
    // const authorResource = booksResource.addResource('{author}');
    // const bookResource = authorResource.addResource('{isbn}');
    // const translationResource = bookResource.addResource('translation');


    // booksResource.addMethod('POST', new apigateway.LambdaIntegration(addBookLambda), {
    //   apiKeyRequired: true,
    // });
    // authorResource.addMethod('GET', new apigateway.LambdaIntegration(getBooksLambda), {
    //   requestParameters: { 'method.request.querystring.genre': true },
    // });
    // bookResource.addMethod('PUT', new apigateway.LambdaIntegration(updateBookLambda), {
    //   apiKeyRequired: true,
    // });
    // translationResource.addMethod('GET', new apigateway.LambdaIntegration(translateBookLambda), {
    //   requestParameters: { 'method.request.querystring.language': true },
    // });


    // // implementing the API key 

    // const apiKey = api.addApiKey('BooksApiKey');
    // const usagePlan = api.addUsagePlan('BooksUsagePlan', {
    //   name: 'BookUsagePlan',
    //   throttle: {
    //     rateLimit: 10,
    //     burstLimit: 2,
    //   }
    // });

    // usagePlan.addApiStage({
    //   stage: api.deploymentStage,
    // });


  }
}
