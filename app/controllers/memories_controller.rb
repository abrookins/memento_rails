class MemoriesController < ApplicationController
  respond_to :json
  before_filter :authenticate_user!

  def index
    @memories = current_user.memories.all
    ActiveRecord::Base.include_root_in_json = false
    respond_with @memories
  end

  def show
    @memory = Memory.find(params[:id])
    ActiveRecord::Base.include_root_in_json = false
    respond_with @memory
  end

  def create
    @memory = Memory.new(params[:memory])
    @memory.user = current_user
    @memory.save

    respond_with(@memory) do |format|
      format.json do |format|
        if @memory.valid? 
          render :json => @memory.to_json
        else
          render :json => @memory.to_json, :status => :unprocessable_entity
        end
      end
    end
  end

  def update
    @memory = Memory.find(params[:id])
    # TODO: Need an edit view for this to work correctly with validation errors?
    @memory.update_attributes(params[:memory])

    respond_with(@map) do |format|
      format.json do |format|
        if @memory.valid? 
          render :json => @memory.to_json
        else
          render :json => @memory.to_json, :status => :unprocessable_entity
        end
      end
    end
  end  

  def destroy
  end
end
